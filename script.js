let commands = [];
let simulationInterval = null; //added

const SIMULATION_DELAY = 1200;

let robot = {
    x: 0,
    y: 0,
    direction: "North",
    energy: 3,
    carrying: false,
    state: "Idle"
};

function convertToValidatorFormat(command) {
    const map = {
        START: "START",
        STOP: "STOP",
        FORWARD: "F",
        BACKWARD: "B",
        LEFT: "L",
        RIGHT: "R",
        PICK: "P",
        DROP: "D",
        RECHARGE: "C"
    };

    return map[command];
}

function getValidatorCommands() {
    return commands.map(convertToValidatorFormat);
}

function validateCommands(cmds) {
    let started = false;
    let moved = false;
    let holding = false;
    let taskDone = false;
    let turnCount = 0;
    let energy = 3;

    let previousCommand = null;
    let loopStage = 0;
    let loopDone = false;

    for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i];

        if (!started) {
            if (cmd === "START") {
                started = true;
                continue;
            }
            return { valid: false, message: "Must start with START" };
        }

        if (cmd === "STOP") {
            if (i !== cmds.length - 1) return { valid: false, message: "Commands are not allowed after STOP" };
            if (!moved) return { valid: false, message: "No movement" };
            if (!taskDone) return { valid: false, message: "No pick-drop task completed" };
            // if (holding) return { valid: false, message: "Robot is still holding object" };
            if (holding && !taskDone) return { valid: false, message: "Robot is still holding object" };
            if (!loopDone) return { valid: false, message: "Loop (F L) ×4 not completed" };

            return { valid: true, message: "Valid command sequence" };
        }

        if (cmd === "F" || cmd === "B") {
            if (energy === 0) {
                return { valid: false, message: `No energy at command ${i + 1}` };
            }

            if (
                (previousCommand === "F" && cmd === "B") ||
                (previousCommand === "B" && cmd === "F")
            ) {
                return {
                    valid: false,
                    message: "Immediate reverse movement is not allowed"
                };
            }

            energy--;
            moved = true;
            turnCount = 0;

            if (!loopDone) {
                if (loopStage === 0 && cmd === "F") loopStage = 1;
                else if (loopStage === 2 && cmd === "F") loopStage = 3;
                else if (loopStage === 4 && cmd === "F") loopStage = 5;
                else if (loopStage === 6 && cmd === "F") loopStage = 7;
                else loopStage = cmd === "F" ? 1 : 0;
            }
        }

        else if (cmd === "L" || cmd === "R") {
            turnCount++;

            if (turnCount > 2) {
                return { valid: false, message: "More than 2 consecutive turns are not allowed" };
            }

            if (!loopDone) {
                if (loopStage === 1 && cmd === "L") loopStage = 2;
                else if (loopStage === 3 && cmd === "L") loopStage = 4;
                else if (loopStage === 5 && cmd === "L") loopStage = 6;
                else if (loopStage === 7 && cmd === "L") {
                    loopStage = 8;
                    loopDone = true;
                }
                else loopStage = 0;
            }
        }

        else if (cmd === "P") {
            if (holding) return { valid: false, message: "Cannot pick twice without dropping" };
            holding = true;
            turnCount = 0;
        }

        else if (cmd === "D") {
            if (!holding) return { valid: false, message: "Cannot drop before picking" };
            holding = false;
            taskDone = true;
            turnCount = 0;
        }

        else if (cmd === "C") {
            energy = 3;
            turnCount = 0;
        }

        else {
            return { valid: false, message: `Invalid command: ${cmd}` };
        }

        previousCommand = cmd;
    }

    return { valid: false, message: "Missing STOP" };
}

function createGrid() {
    const grid = document.getElementById("grid");
    grid.innerHTML = "";

    for (let row = 7; row >= 0; row--) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement("div");
            cell.className = "grid-cell";

            if (robot.x === col && robot.y === row) {
                const robotIcon = document.createElement("div");
                robotIcon.className = "robot-icon";
                const robotImage = document.createElement("img");
                robotImage.className = "robot-image";
                robotImage.src = "assets/robot.png";
                robotImage.alt = "Robot marker";
                robotIcon.appendChild(robotImage);

                if (robot.carrying) {
                    const carriedObject = document.createElement("div");
                    carriedObject.className = "carried-object";

                    const carriedImage = document.createElement("img");
                    carriedImage.className = "object-image";
                    carriedImage.src = "assets/ball.png";
                    carriedImage.alt = "Carried object";
                    carriedObject.appendChild(carriedImage);
                    robotIcon.appendChild(carriedObject);
                }

                cell.appendChild(robotIcon);

                // Visual direction indicator (a dot near the edge the robot faces)
                const faceDot = document.createElement("div");
                faceDot.className = `face-dot face-${robot.direction.toLowerCase()}`;
                faceDot.innerText = ".";
                cell.appendChild(faceDot);
            } else {
                cell.innerText = `(${col},${row})`;
            }

            grid.appendChild(cell);
        }
    }
}

function addCommand(command) {
    commands.push(command);
    updateCommandQueue();
    addLog(`Command added: ${command}`, "normal");
}

function removeCommand(index) {
    // If the simulation is running, stop it and reset the robot safely
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        resetRobot();
        addLog("Simulation stopped due to queue modification.", "error");
    }

    const removedCmd = commands[index];
    commands.splice(index, 1); // Remove the command at the specified index
    updateCommandQueue();       // Refresh the queue UI
    addLog(`Removed command: ${removedCmd}`, "normal");
}


function updateCommandQueue() {
    const queue = document.getElementById("commandQueue");
    const stepCount = document.getElementById("stepCount");

    stepCount.innerText = `${commands.length} STEPS LOADED`;
    queue.innerHTML = "";

    if (commands.length === 0) {
        queue.innerText = "No commands yet";
        return;
    }

    // commands.forEach((cmd, index) => {
    //     const chip = document.createElement("div");
    //     chip.className = "command-chip";
    //     chip.innerText = cmd;
    //     queue.appendChild(chip);

    //     if (index < commands.length - 1) {
    //         const arrow = document.createElement("span");
    //         arrow.className = "arrow";
    //         arrow.innerText = "→";
    //         queue.appendChild(arrow);
    //     }
    // });

    commands.forEach((cmd, index) => {
        const chip = document.createElement("div");
        chip.className = "command-chip";

        // 1. Text label for the command
        const label = document.createElement("span");
        label.innerText = cmd;
        chip.appendChild(label);

        // 2. Delete button (x)
        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = "×";
        // Styled with matching slate colors, changing to red/error color on hover
        deleteBtn.className = "text-on-surface-variant hover:text-error transition-colors focus:outline-none font-bold text-sm leading-none cursor-pointer";
        deleteBtn.title = "Delete this command";
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            removeCommand(index);
        };
        chip.appendChild(deleteBtn);

        queue.appendChild(chip);

        if (index < commands.length - 1) {
            const arrow = document.createElement("span");
            arrow.className = "arrow";
            arrow.innerText = "→";
            queue.appendChild(arrow);
        }
    });

}

function runCommands() {
    if (commands.length === 0) {
        addLog("No commands to run.", "error");
        return;
    }

    const validatorCommands = getValidatorCommands();
    const result = validateCommands(validatorCommands);

    addLog("UI format: " + commands.join(" → "), "normal");
    addLog("Validator format: " + validatorCommands.join(" "), "normal");

    if (!result.valid) {
        addLog("Invalid sequence: " + result.message, "error");
        robot.state = "Rejected";
        updateStatus();
        return;
    }

    addLog("Valid sequence: " + result.message, "success");
    if (simulationInterval) {
        clearInterval(simulationInterval);
    }
    simulateCommands(commands);
}

function simulateCommands(commandList) {
    if (robot.energy <= 0) {
        // clearInterval(interval);
        clearInterval(simulationInterval);
        simulationInterval = null;
        addLog("Simulation stopped: No energy", "error");
        robot.state = "Rejected";
        updateStatus();
        return;
    }
    resetRobot();

    let index = 0;

    // const interval = setInterval(() => { added
    simulationInterval = setInterval(() => {
        if (index >= commandList.length) {
            clearInterval(simulationInterval);
            simulationInterval = null;
            robot.state = "Finished";
            updateStatus();
            addLog("Simulation finished.", "success");
            return;
        }

        const cmd = commandList[index];

        if (
            (cmd === "FORWARD" || cmd === "BACKWARD") &&
            robot.energy <= 0
        ) {
            clearInterval(simulationInterval);
            simulationInterval = null;
            addLog("Simulation stopped: No energy", "error");
            robot.state = "Rejected";
            updateStatus();
            return;
        }

        executeCommand(cmd);

        addLog("Executed: " + cmd, "normal");

        updateStatus();
        createGrid();

        index++;
    }, SIMULATION_DELAY);
}

function resetRobot() {
    // robot.x = 0;
    // robot.y = 0;
    // robot.direction = "North";

    robot.energy = 3;
    robot.carrying = false;
    robot.state = "Running";

    updateStatus();
    createGrid();
}

function executeCommand(cmd) {
    if (cmd === "START" || cmd === "STOP") return;

    if (cmd === "FORWARD") moveForward();
    else if (cmd === "BACKWARD") moveBackward();
    else if (cmd === "LEFT") turnLeft();
    else if (cmd === "RIGHT") turnRight();
    else if (cmd === "PICK") robot.carrying = true;
    else if (cmd === "DROP") robot.carrying = false;
    else if (cmd === "RECHARGE") robot.energy = 3;
}

function moveForward() {
    if (robot.energy <= 0) {
        addLog("No energy. Robot cannot move forward.", "error");
        return;
    }

    // if (robot.direction === "North" && robot.y < 7) robot.y++;
    // else if (robot.direction === "South" && robot.y > 0) robot.y--;
    // else if (robot.direction === "East" && robot.x < 7) robot.x++;
    // else if (robot.direction === "West" && robot.x > 0) robot.x--;
    if (robot.direction === "North")
        robot.y = (robot.y + 1) % 8;
    else if (robot.direction === "South")
        robot.y = (robot.y - 1 + 8) % 8;
    else if (robot.direction === "East")
        robot.x = (robot.x + 1) % 8;
    else if (robot.direction === "West")
        robot.x = (robot.x - 1 + 8) % 8;

    robot.energy--;
}

function moveBackward() {
    if (robot.energy <= 0) {
        addLog("No energy. Robot cannot move backward.", "error");
        return;
    }

    // if (robot.direction === "North" && robot.y > 0) robot.y--;
    // else if (robot.direction === "South" && robot.y < 7) robot.y++;
    // else if (robot.direction === "East" && robot.x > 0) robot.x--;
    // else if (robot.direction === "West" && robot.x < 7) robot.x++;

    if (robot.direction === "North")
        robot.y = (robot.y - 1 + 8) % 8;
    else if (robot.direction === "South")
        robot.y = (robot.y + 1) % 8;
    else if (robot.direction === "East")
        robot.x = (robot.x - 1 + 8) % 8;
    else if (robot.direction === "West")
        robot.x = (robot.x + 1) % 8;

    robot.energy--;
}

function turnLeft() {
    const left = {
        North: "West",
        West: "South",
        South: "East",
        East: "North"
    };

    robot.direction = left[robot.direction];
}

function turnRight() {
    const right = {
        North: "East",
        East: "South",
        South: "West",
        West: "North"
    };

    robot.direction = right[robot.direction];
}

// function clearCommands() {
//     commands = [];
//     updateCommandQueue();
//     addLog("Command queue cleared.", "success");
// }
function clearCommands() {
    commands = [];
    clearInterval(simulationInterval);

    resetRobot();
    updateCommandQueue();
    addLog("Command queue cleared.", "success");
}

function updateStatus() {
    // document.getElementById("position").innerText = `(${robot.x},${robot.y})`;
    // document.getElementById("direction").innerText = robot.direction;
    // document.getElementById("energyText").innerText = `${robot.energy}/3`;
    // document.getElementById("carrying").innerText = robot.carrying ? "Yes" : "No";
    // document.getElementById("state").innerText = robot.state;
    const positionEl = document.getElementById("position");
    if (positionEl) positionEl.innerText = `(${robot.x},${robot.y})`;

    // const energyPercent = (robot.energy / 3) * 100;
    // document.getElementById("energyBar").style.width = `${energyPercent}%`;

}

function addLog(message, type = "normal") {
    const logs = document.getElementById("logs");
    const p = document.createElement("p");

    if (type === "success") {
        p.className = "text-secondary";
    } else if (type === "error") {
        p.className = "text-error";
    } else {
        p.className = "text-on-surface";
    }

    p.innerText = `> ${message}`;
    logs.appendChild(p);
    logs.scrollTop = logs.scrollHeight;
}

createGrid();
updateStatus();
updateCommandQueue();