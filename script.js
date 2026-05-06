let commands = [];

const SIMULATION_DELAY = 1200;

let robot = {
    x: 0,
    y: 0,
    direction: "North",
    energy: 3,
    carrying: false,
    state: "Idle"
};

// Convert UI command names to Pu Sok's command format
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

// Prepare command list for Pu Sok's validator
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

    let lastMove = null;
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
            if (!moved) return { valid: false, message: "No movement" };
            if (!taskDone) return { valid: false, message: "No pick-drop task completed" };
            if (holding) return { valid: false, message: "Robot is still holding object" };
            if (!loopDone) return { valid: false, message: "Loop (F L) ×4 not completed" };

            return { valid: true, message: "Valid command sequence" };
        }

        if (cmd === "F" || cmd === "B") {
            if (energy === 0) {
                return { valid: false, message: `No energy at command ${i + 1}` };
            }

            if (lastMove === "F" && cmd === "B") {
                return { valid: false, message: "Cannot move Backward immediately after Forward" };
            }

            if (lastMove === "B" && cmd === "F") {
                return { valid: false, message: "Cannot move Forward immediately after Backward" };
            }

            energy--;
            moved = true;
            turnCount = 0;
            lastMove = cmd;

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
                robotIcon.innerText = "🤖";
                cell.appendChild(robotIcon);
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

function updateCommandQueue() {
    const queue = document.getElementById("commandQueue");
    const stepCount = document.getElementById("stepCount");

    stepCount.innerText = `${commands.length} STEPS LOADED`;
    queue.innerHTML = "";

    if (commands.length === 0) {
        queue.innerText = "No commands yet";
        return;
    }

    commands.forEach((cmd, index) => {
        const chip = document.createElement("div");
        chip.className = "command-chip";
        chip.innerText = cmd;
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
    simulateCommands(commands);
}

function simulateCommands(commandList) {
    if (robot.energy <= 0) {
        clearInterval(interval);
        addLog("Simulation stopped: No energy", "error");
        robot.state = "Rejected";
        updateStatus();
        return;
    }
    resetRobot();

    let index = 0;

    const interval = setInterval(() => {
        if (index >= commandList.length) {
            clearInterval(interval);
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
            clearInterval(interval);
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
    robot.x = 0;
    robot.y = 0;
    robot.direction = "North";
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

    if (robot.direction === "North" && robot.y < 7) robot.y++;
    else if (robot.direction === "South" && robot.y > 0) robot.y--;
    else if (robot.direction === "East" && robot.x < 7) robot.x++;
    else if (robot.direction === "West" && robot.x > 0) robot.x--;

    robot.energy--;
}

function moveBackward() {
    if (robot.energy <= 0) {
        addLog("No energy. Robot cannot move backward.", "error");
        return;
    }

    if (robot.direction === "North" && robot.y > 0) robot.y--;
    else if (robot.direction === "South" && robot.y < 7) robot.y++;
    else if (robot.direction === "East" && robot.x > 0) robot.x--;
    else if (robot.direction === "West" && robot.x < 7) robot.x++;

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

function clearCommands() {
    commands = [];
    updateCommandQueue();
    addLog("Command queue cleared.", "success");
}

function emergencyStop() {
    commands = [];
    robot.state = "Emergency Stop";
    updateCommandQueue();
    updateStatus();
    addLog("EMERGENCY STOP activated.", "error");
}

function updateStatus() {
    document.getElementById("position").innerText = `(${robot.x},${robot.y})`;
    document.getElementById("direction").innerText = robot.direction;
    document.getElementById("energyText").innerText = `${robot.energy}/3`;
    document.getElementById("carrying").innerText = robot.carrying ? "Yes" : "No";
    document.getElementById("state").innerText = robot.state;

    const energyPercent = (robot.energy / 3) * 100;
    document.getElementById("energyBar").style.width = `${energyPercent}%`;
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