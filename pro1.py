import tkinter as tk
import time

CELL_SIZE = 50
GRID_SIZE = 8

# ================= VALIDATION =================
def validate(commands):
    started = False
    moved = False
    holding = False
    task_done = False
    turn_count = 0
    energy = 3

    last_move = None   # NEW (F or B)
    loop_stage = 0     # NEW (0 → 8)
    loop_done = False  # NEW

    for cmd in commands:

        # ---------------- START ----------------
        if not started:
            if cmd == "START":
                started = True
                continue
            else:
                return False, "Must start with START"

        # ---------------- STOP ----------------
        if cmd == "STOP":
            if not moved:
                return False, "No movement"
            if not task_done:
                return False, "No pick-drop task"
            if holding:
                return False, "Still holding object"
            if not loop_done:
                return False, "Loop (F L ×4) not completed"
            return True, "Valid sequence"

        # ---------------- MOVEMENT ----------------
        if cmd in ["F", "B"]:

            # Energy rule
            if energy == 0:
                return False, "No energy"

            # Reverse rule
            if last_move == "F" and cmd == "B":
                return False, "Cannot reverse F → B"
            if last_move == "B" and cmd == "F":
                return False, "Cannot reverse B → F"

            energy -= 1
            moved = True
            turn_count = 0
            last_move = cmd

            #  LOOP TRACKING
            if not loop_done:
                if loop_stage == 0 and cmd == "F":
                    loop_stage = 1
                elif loop_stage == 2 and cmd == "F":
                    loop_stage = 3
                elif loop_stage == 4 and cmd == "F":
                    loop_stage = 5
                elif loop_stage == 6 and cmd == "F":
                    loop_stage = 7
                else:
                    # reset if pattern broken
                    if cmd == "F":
                        loop_stage = 1
                    else:
                        loop_stage = 0

        # ---------------- TURN ----------------
        elif cmd in ["L", "R"]:
            turn_count += 1

            if turn_count > 2:
                return False, "Too many consecutive turns"

            #  LOOP TRACKING (only L matters)
            if not loop_done:
                if loop_stage == 1 and cmd == "L":
                    loop_stage = 2
                elif loop_stage == 3 and cmd == "L":
                    loop_stage = 4
                elif loop_stage == 5 and cmd == "L":
                    loop_stage = 6
                elif loop_stage == 7 and cmd == "L":
                    loop_stage = 8
                    loop_done = True
                else:
                    # reset if wrong turn
                    loop_stage = 0

        # ---------------- PICK ----------------
        elif cmd == "P":
            if holding:
                return False, "Already holding"
            holding = True
            turn_count = 0

        # ---------------- DROP ----------------
        elif cmd == "D":
            if not holding:
                return False, "Drop without pick"
            holding = False
            task_done = True
            turn_count = 0

        # ---------------- CHARGE ----------------
        elif cmd == "C":
            energy = 3
            turn_count = 0

        else:
            return False, f"Invalid command {cmd}"

    return False, "Missing STOP"


# ================= GUI =================
class RobotGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Robot Navigation FA")

        self.canvas = tk.Canvas(root, width=GRID_SIZE*CELL_SIZE,
                                height=GRID_SIZE*CELL_SIZE, bg="white")
        self.canvas.pack()

        self.entry = tk.Entry(root, width=60)
        self.entry.pack(pady=10)

        self.btn = tk.Button(root, text="Run", command=self.run)
        self.btn.pack()

        self.status = tk.Label(root, text="")
        self.status.pack()

        self.reset()

    def reset(self):
        self.x = 0
        self.y = 0
        self.direction = "N"
        self.energy = 3

        self.draw_grid()
        self.draw_robot()

    def draw_grid(self):
        self.canvas.delete("all")
        
        # Alternate between two shades of green for a natural grass checkerboard
        grass_colors = ["#4CAF50", "#45A049"]
        dark_green = "#2E7D32"
        
        for i in range(GRID_SIZE):
            for j in range(GRID_SIZE):
                x1 = i * CELL_SIZE
                y1 = (GRID_SIZE - 1 - j) * CELL_SIZE
                x2 = (i + 1) * CELL_SIZE
                y2 = (GRID_SIZE - j) * CELL_SIZE

                # Alternate tile shading like a lawn/football field
                color = grass_colors[(i + j) % 2]

                # Draw base grass tile
                self.canvas.create_rectangle(
                    x1, y1, x2, y2,
                    fill=color, outline=dark_green, width=1
                )

                # Add grass blade details (small vertical lines)
                import random
                random.seed(i * 100 + j)  # deterministic so it doesn't flicker
                for _ in range(4):
                    bx = random.randint(x1 + 2, x2 - 2)
                    by = random.randint(y1 + 4, y2 - 2)
                    blade_color = "#66BB6A" if color == "#4CAF50" else "#81C784"
                    self.canvas.create_line(
                        bx, by, bx - 1, by - 4,
                        fill=blade_color, width=1
                    )
                    self.canvas.create_line(
                        bx, by, bx + 1, by - 4,
                        fill=blade_color, width=1
                    )

    def draw_robot(self):
        self.canvas.delete("robot")
        x1 = self.x * CELL_SIZE
        y1 = (GRID_SIZE - 1 - self.y) * CELL_SIZE

        # --- Crown on head (gold spikes) ---
        # Crown base
        self.canvas.create_rectangle(
            x1 + 12, y1 + 0, x1 + 38, y1 + 5,
            fill="#FFD700", outline="#FFA500", width=1, tags="robot"
        )
        # Crown spike left
        self.canvas.create_polygon(
            x1 + 14, y1 + 0,
            x1 + 17, y1 - 8,
            x1 + 20, y1 + 0,
            fill="#FFD700", outline="#FFA500", width=1, tags="robot"
        )
        # Crown spike middle
        self.canvas.create_polygon(
            x1 + 22, y1 + 0,
            x1 + 25, y1 - 10,
            x1 + 28, y1 + 0,
            fill="#FFD700", outline="#FFA500", width=1, tags="robot"
        )
        # Crown spike right
        self.canvas.create_polygon(
            x1 + 30, y1 + 0,
            x1 + 33, y1 - 8,
            x1 + 36, y1 + 0,
            fill="#FFD700", outline="#FFA500", width=1, tags="robot"
        )
        # Crown jewel (red gem in middle spike)
        self.canvas.create_oval(
            x1 + 23, y1 - 6, x1 + 27, y1 - 2,
            fill="#FF0000", outline="#CC0000", tags="robot"
        )

        # --- Head (pink rectangle) ---
        self.canvas.create_rectangle(
            x1 + 12, y1 + 4, x1 + 38, y1 + 18,
            fill="#FF69B4", outline="#CC1477", width=1, tags="robot"
        )

        # --- Left eye (white oval with black pupil) ---
        self.canvas.create_oval(
            x1 + 15, y1 + 6, x1 + 23, y1 + 14,
            fill="white", outline="black", width=1, tags="robot"
        )
        self.canvas.create_oval(
            x1 + 17, y1 + 8, x1 + 21, y1 + 12,
            fill="black", tags="robot"
        )

        # --- Right eye (white oval with black pupil) ---
        self.canvas.create_oval(
            x1 + 27, y1 + 6, x1 + 35, y1 + 14,
            fill="white", outline="black", width=1, tags="robot"
        )
        self.canvas.create_oval(
            x1 + 29, y1 + 8, x1 + 33, y1 + 12,
            fill="black", tags="robot"
        )

        # --- Body (pink rectangle) ---
        self.canvas.create_rectangle(
            x1 + 8, y1 + 18, x1 + 42, y1 + 40,
            fill="#FF69B4", outline="#CC1477", width=1, tags="robot"
        )

        # --- Left Arm ---
        # Upper arm
        self.canvas.create_rectangle(
            x1 - 6, y1 + 18, x1 + 8, y1 + 28,
            fill="#FF69B4", outline="#CC1477", width=1, tags="robot"
        )
      
        # --- Right Arm ---
        # Upper arm
        self.canvas.create_rectangle(
            x1 + 42, y1 + 18, x1 + 56, y1 + 28,
            fill="#FF69B4", outline="#CC1477", width=1, tags="robot"
        )
        
        # Back-left leg
        self.canvas.create_rectangle(
            x1 + 17, y1 + 40, x1 + 23, y1 + 52,
            fill="black", tags="robot"
        )
        # Back-right leg
        self.canvas.create_rectangle(
            x1 + 27, y1 + 40, x1 + 33, y1 + 52,
            fill="black", tags="robot"
        )

        # direction indicator
        dx, dy = 0, 0
        if self.direction == "N": dy = -10
        elif self.direction == "S": dy = 10
        elif self.direction == "E": dx = 10
        elif self.direction == "W": dx = -10

        self.canvas.create_line(
            x1+25, y1+25,
            x1+25+dx, y1+25+dy,
            width=3, fill="red", tags="robot"
        )

    def run(self):
        self.reset()

        commands = self.entry.get().strip().split()

        valid, msg = validate(commands)
        if not valid:
            self.status.config(text="❌ " + msg, fg="red")
            return
        else:
            self.status.config(text="✅ Valid sequence", fg="green")

        self.simulate(commands)

    def simulate(self, commands):
        direction_map = {
            "N": (0, 1),
            "E": (1, 0),
            "S": (0, -1),
            "W": (-1, 0)
        }

        left_turn = {"N": "W", "W": "S", "S": "E", "E": "N"}
        right_turn = {"N": "E", "E": "S", "S": "W", "W": "N"}

        for cmd in commands:
            self.root.update()
            time.sleep(0.5)

            if cmd == "START":
                continue
            if cmd == "STOP":
                break

            if cmd == "F":
                dx, dy = direction_map[self.direction]
                self.x += dx
                self.y += dy
                self.energy -= 1

            elif cmd == "B":
                dx, dy = direction_map[self.direction]
                self.x -= dx
                self.y -= dy
                self.energy -= 1

            elif cmd == "L":
                self.direction = left_turn[self.direction]

            elif cmd == "R":
                self.direction = right_turn[self.direction]

            elif cmd == "C":
                self.energy = 3

            # keep inside grid
            self.x = max(0, min(7, self.x))
            self.y = max(0, min(7, self.y))

            self.draw_grid()
            self.draw_robot()

            self.status.config(
                text=f"Cmd: {cmd} | Energy: {self.energy} | Dir: {self.direction}"
            )


# ================= RUN =================
root = tk.Tk()
app = RobotGUI(root)
root.mainloop()