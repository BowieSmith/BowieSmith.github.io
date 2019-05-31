// global var to set draw mode
let draw_mode = "draw";

// Makes a new cell in a game of life grid
// Implemented as "div" html tag
// args:
//   size - square dimension size of cell in pixels
//   xpos - left offset within game of life grid
//   ypos - top offset with grid
// returns:
//   reference to new "div" DOM element
let new_cell = function(size, xpos, ypos) {
    let new_cell = document.createElement("div");
    new_cell.className = "cell";
    new_cell.style.left = xpos + "px";
    new_cell.style.top = ypos + "px";
    new_cell.style.width = size + "px";
    new_cell.style.height = size + "px";
    new_cell.style.backgroundColor = "transparent";
    new_cell.addEventListener("click", () => {
        new_cell.style.backgroundColor =
            new_cell.style.backgroundColor === "black" ? "transparent" : "black";
    });
    new_cell.addEventListener("mouseenter", (event) => {
        if (event.buttons == 1) {
            if (draw_mode === "draw") {
                new_cell.style.backgroundColor = "black";
            } else {
                new_cell.style.backgroundColor = "transparent";
            }
        }
    });
    return new_cell;
};

// start grid with neat pattern!
let init_cell_pattern = function(cells, cells_per_row) {
    let total = cells_per_row * cells_per_row;
    let half = Math.floor(total / 2) - Math.floor(cells_per_row / 2);
    let cells_to_init = [];
    cells_to_init.push(
        cells[half - 2],
        cells[half],
        cells[half + 2],
        cells[half - cells_per_row - 1],
        cells[half - cells_per_row + 1],
        cells[half + cells_per_row - 1],
        cells[half + cells_per_row + 1]
    );
    cells_to_init.forEach(cell => cell.style.backgroundColor = "black");
};

// Makes new grid for game of life
// Cells are generated and stored in array
// Number of cells calculated based on cell size and grid dimension
// args:
//   cell_size - square dimension of individual cells in pixels
//   grid_dimension - square dimension of entire grid in pixels
// returns:
//   array of references to "div" elements representing cells
let make_grid = function(grid_dimension, cells_per_row) {
    let cells = [];
    let cell_size = grid_dimension / cells_per_row;
    for (let i = 0; i < Math.pow(cells_per_row, 2); i++) {
        cells.push(new_cell(
            cell_size,
            (i * cell_size) % grid_dimension,
            Math.floor(i / cells_per_row) * cell_size));
    }
    let container = document.querySelector("#gol_container");
    cells.forEach(cell => container.appendChild(cell));
    container.style.width = grid_dimension + "px";
    container.style.height = grid_dimension + "px";
    return cells;
};

// makeshift modulo operator
let mod = function(n, m) {
    return ((n % m) + m) % m;
};

// Counts total number of neighbors at given cells index
// args:
//   cells: array of references to "div" elements representing cells
//   index: index of cell we desire a neighbor count for
//   cells_per_row: total cells per row of grid
// returns:
//   integer representing total count of activated neighbors (with backgroundColor === "black")
let count_neighbors = function(cells, index, cells_per_row) {
    let total = 0;
    let neighbor_indices = [index - cells_per_row - 1,
                            index - cells_per_row,
                            index - cells_per_row + 1,
                            index - 1,
                            index + 1,
                            index + cells_per_row - 1,
                            index + cells_per_row,
                            index + cells_per_row + 1];
    neighbor_indices = neighbor_indices.map(i => mod(i, Math.pow(cells_per_row, 2))); 
    for (let index of neighbor_indices) {
        if (cells[index].style.backgroundColor === "black") {
            total += 1;
        }
    };
    return total;
};

// function to animate game of life
// calls setTimeout in a loop to repeatedly count neighbors and activate/deactivate cells
// args:
//   cells: array of "div" elements representing cells
//   cells_per_row: cells per row of game of life grid
// returns:
//   animation_countroller: object to control animation
//     {
//       timer: speed of animation (in milliseconds),
//       running: boolean value to turn on/off animation,
//     }
let animate = function(cells, grid_dimension, cells_per_row) {
    let animation_controller = {
        timer: 100,
        running: false,
    };
    let helper = function() {
        let neighbor_counts = [];
        if (animation_controller.running) {
            for (let i = 0; i < Math.pow(cells_per_row, 2); i++) {
                neighbor_counts.push(count_neighbors(cells, i, cells_per_row));
            }
            for (let i = 0; i < Math.pow(cells_per_row, 2); i++) {
                let neighbors = neighbor_counts[i];
                if (neighbors < 2 || neighbors > 3) {
                    cells[i].style.backgroundColor = "transparent";
                }
                else if (neighbors === 3) {
                    cells[i].style.backgroundColor = "black";
                }
            }
        }
        setTimeout(helper, animation_controller.timer);
    };
    helper();
    return animation_controller;
};


let gridSizeTextInput = document.querySelector("#grid_size");
let grid_dimension = parseFloat(gridSizeTextInput.value);
let cellCountTextInput = document.querySelector("#cell_count");
let cells_per_row = parseFloat(cellCountTextInput.value);

let cells = make_grid(grid_dimension, cells_per_row);
init_cell_pattern(cells, cells_per_row);
let animation_controller = animate(cells, grid_dimension, cells_per_row);


let toggleButton = document.querySelector("#toggle");
toggleButton.addEventListener("click", () => {
    if (toggleButton.textContent === "Stop") {
        animation_controller.running = false;
        toggleButton.textContent = "Start";
    }
    else {
        animation_controller.running = true;
        toggleButton.textContent = "Stop";
    }
});

let speedTextInput = document.querySelector("#speed");
speedTextInput.addEventListener("keyup", () => {
    let val = parseFloat(speedTextInput.value);
    if (!isNaN(val)) {
        animation_controller.timer = val;
    }
});

let clearButton = document.querySelector("#clear");
clearButton.addEventListener("click", () => {
    cells.forEach(cell => cell.style.backgroundColor = "transparent");
});

let rebuild_container = function(grid_dim, cells_pr_row) {
    grid_dimension = grid_dim;
    cells_per_row = cells_pr_row;
    let container = document.querySelector("#gol_container");
    container.style.width = grid_dimension + "px";
    container.style.height = grid_dimension + "px";
    while (container.hasChildNodes()) {
        container.removeChild(container.firstChild);
    }
    cells = make_grid(grid_dimension, cells_per_row);
    animation_controller = animate(cells, grid_dimension, cells_per_row);
    toggleButton.textContent = "Start";
};

gridSizeTextInput.addEventListener("keyup", () => {
    let val = parseFloat(gridSizeTextInput.value);
    if (!isNaN(val)) {
        grid_dimension = val;
        rebuild_container(grid_dimension, cells_per_row);
    }
});

cellCountTextInput.addEventListener("keyup", () => {
    let val = parseFloat(cellCountTextInput.value);
    if (!isNaN(val)) {
        cells_per_row = val;
        rebuild_container(grid_dimension, cells_per_row);
    }
});

let draw_mode_div = document.querySelector("#draw_mode_div");
draw_mode_div.addEventListener("click", () => {
    draw_mode = document.querySelector('input[name="mode"]:checked').value;
});
