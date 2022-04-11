/***** Title *****/
// The Chaos Game
// The Web Devs
// Latest Revision: 4/8/22
/*****************/

/****** Description *****/
// This is the main program that runs on the game page
// It runs the game, handles input/output, generates new points, and renders the new points
/************************/

/***** Major data structures *****/
// Defined Globally:
// config: is the go-between object for the user input data and animation configuration (the user manipulates the config which manipulates animation)
// Point: a class for handling point information
// Color: a class for handling color information

// Within main():
// DOM objects: as often occurs in JS programs, DOM elements are accessed and manipulated
// State object: Encapsulates animation data, and multiple arrays are used (includes generated points, undid points, etc.)
// Flags object: flags for the state of the program are encapsulated in a flag object
// WebGL context object: used for animating and to communicate with the GPU and canvas element
/*********************************/

// The configuration object
// Interface with this object to manipulate the animation of points
let config = {
    SPEED: 1000,
    COLOR: 180,
    PLAY: true,
    TOTAL_POINTS: 3000,
}

// Point constructor
// This is a class to handle point information
// Label information is included, though not always used
// If the label information is not used, by default the label is "N/A"
// Also uses default parameters as suggested by John
function Point(x = 0, y = 0, label = "N/A", border = false) {
    this.x = x;
    this.y = y;
    this.border = border;
    this.label = label;

    this.unit = function () {
        this.x = this.x / Math.sqrt(this.x * this.x + this.y * this.y);
        this.y = this.y / Math.sqrt(this.x * this.x + this.y * this.y);
    }
}

// Color object
// Uses default parameters as suggested by John
function Color(r = 0, g = 0, b = 0) {
    this.r = r;
    this.g = g;
    this.b = b;
}

// The vertex shader
let VSHADER = `
    attribute vec4 a_Position;
    attribute float a_border;
    varying float v_border;
    uniform float u_pointSize;
    
    void main() {
        v_border = a_border;
        gl_Position = a_Position;
        
        if (a_border > 0.5) {
            gl_PointSize = u_pointSize + 3.0;
        } else {
            gl_PointSize = u_pointSize;
        }
    }`;

// The fragment shader
let FSHADER = `
    #extension GL_EXT_shader_texture_lod : enable
    #extension GL_OES_standard_derivatives : enable
    
    precision highp float;
    uniform vec4 u_Color;
    varying float v_border;
   
    void main() {
        float d = distance(vec2(0.5, 0.5), gl_PointCoord);
        vec4 cout = u_Color;

        // FRAGMENT SHADER CODE BASED ON: https://www.desultoryquest.com/blog/drawing-anti-aliased-circular-points-using-opengl-slash-webgl/
        
        if (v_border > 0.5) {
            cout = vec4(0.0, 0.0, 0.0, 1.0);
        }
        
        float r = 0.0, delta = 0.0, alpha = 1.0;
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        r = dot(cxy, cxy);
        delta = fwidth(r);
        alpha = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);

        gl_FragColor = cout * alpha; 

    }`;

// Main game program
function main(selection) {
    let canvas;                                     // Canvas element
    let innerGame;                                  // Inner div where the points are drawn
	let messageBox;									// Messages for the user
	let pointsPlaced;								// Number of points drawn message
    let webGL;                                      // The drawing context
    let animID;                                     // The animation frame ID

    let run;                                        // The run button
    let reset;                                      // The reset button
    let speed;                                      // The speed slider
    let playPause;                                  // The play/pause button
    let color;                                      // The color slider
    let undo;                                       // The undo button
    let redo;                                       // The redo button
    let newN;                                       // Get a new number of points

    // Encapsulating the flags in an object
    let flags = {
        run: false,                                 // flag to alert the program that the user wants to run the game
        spawnAnimation: false,                      // flag to alert the program to spawn an animation
        endGame: false                              // flag to alert to program to end the game
    }

    // Encapsulate the data needed for animation in the state object
    // Since we are working with low level graphics, we constantly
    // need access to the state data to change how we are drawing
    let state = {
        n: selection,                                                          // The number of points
        mousePosition: new Point(0, 0, "", true),            // Current mouse position
        current: new Point(0, 0, ""),                               // Current position for drawing
        points: [],                                                             // Selected point array
        generatedPoints: [],                                                    // Generated points array
        undid: [],                                                              // The undone points
    }

    // TO-DO
    // Encapsulate the DOM elements for the controls
    let controls = {

    }

    // Insert a loop determining if controls exist

    // Get DOM elements
    canvas = document.getElementById("webGL");
    innerGame = document.getElementById("inner_game");
	messageBox = document.getElementById("message_box");
	pointsPlaced = document.getElementById("points_placed");
	
    run = document.getElementById("run");
    reset = document.getElementById("reset")
    speed = document.getElementById("speed");
    playPause = document.getElementById("play_pause");
    color = document.getElementById("color");
    undo = document.getElementById("undo");
    redo = document.getElementById("redo")
    newN = document.getElementById("new");

    // Resize canvas
    canvas.width = innerGame.getBoundingClientRect().width;
    canvas.height = innerGame.getBoundingClientRect().height;

    // Get context and initialize the shaders
    webGL = canvas.getContext("webgl");
    webGL.getExtension('OES_standard_derivatives');
    webGL.getExtension('EXT_shader_texture_lod');
    initShaders(webGL, VSHADER, FSHADER);
    webGL.enable(webGL.BLEND);
    webGL.blendFunc(webGL.SRC_ALPHA, webGL.ONE_MINUS_SRC_ALPHA);

    // Set slider events (also initialize the slider values)
    speed.oninput = function() {
        config.SPEED = speed.max - speed.value;
        update();
    }
    speed.value = speed.max - config.SPEED;
    color.oninput = function() {
        config.COLOR = color.value;
        update();
    }
    color.value = config.COLOR;

    // Undo Button
    undo.onclick = function() {
        // Remove the label and its point and store it in undid
        removePointAndLabel(state.points, state.undid, innerGame);

        // Note that the mousePosition will still be included for the first undo
        // which will cause the point to still be drawn. To remedy this, the mouse
        // position is moved completely off the canvas
        state.mousePosition.x = 2.0;
        state.mousePosition.y = 2.0;

        update();
    }

    // Redo Button
    redo.onclick = function () {
        // Since labels are automatic within the update function,
        // no need to specify any particular label to add
        redoPoint(state.points, state.undid);
        update();
    }

    // Reset button
    // Clear all animation information
    // and previously drawn elements
    reset.onclick = function () {
        flags.run = false;
        flags.spawnAnimation = false;
        flags.endGame = false;
        state.points.length = 0;
        state.generatedPoints.length = 0;
        state.undid.length = 0;
        state.mousePosition.x = 2.0;
        state.mousePosition.y = 2.0;
        state.mousePosition.border = true;
        config.COLOR = color.value = "180";
        config.SPEED = speed.value = "1000";
        config.PLAY = false;
        cancelAnimationFrame(animID);
        clearChildren(innerGame);
        updatePlayPause(playPause, config);
        update();
    }

    playPause.onclick = function() {
        updatePlayPause(playPause, config);
    }

    function updatePlayPause(playPause, config) {
        if (config.PLAY) {
            config.PLAY = false;
            playPause.value = "\u23F5";
        } else {
            config.PLAY = true;
            playPause.value = "\u23F8";
        }
    }

    // For a new set of points, just refresh the page
    newN.onclick = function() {
        window.location.reload();
    }

    // Run button
    // Set the flags to true
    run.onclick = function () {
        flags.run = true;
        flags.spawnAnimation = true;
        update();
    }

    // Bind events
    enableCanvasEvents(canvas, update, state);

    // Initialize the number of points displayed as zero
    updateInnerHtml(pointsPlaced, "Points: " + 0);

    // If the window resizes, adjust the rendering context accordingly
    window.onresize = function() {
        resize(webGL, canvas, innerGame);
        update();
    }

    // Start with buttons disabled
    disable(run);
    disable(undo);
    disable(redo);
    disable(playPause);

    // The update function
    // Called to make rendering changes
    function update() {
        // The output vertex array
        let totalPoints = [state.mousePosition];

        // Letting the program know how many borders to draw
        let borders = 0;

        // Insert the selected points into the output vertices
        state.points.forEach(pointObject => {
            totalPoints.push(pointObject);
        });

        // Only label the points if they are the initial ones
        if (state.points.length < state.n + 1 && !flags.endGame) {
            // Update the message
            updateInnerHtml(messageBox, "Click on the board to select points!");
            addLabels(state.points, canvas);

            // Tell the user to select a starting position
            if (state.points.length === state.n && !flags.endGame) {
                updateInnerHtml(messageBox, "Select a starting position!");
            }

            // If a point is the starting point, label it
        } else if (state.points.length === state.n + 1 && !flags.run && !flags.endGame) {
            addCustomLabel(state.points[state.n], canvas, "Start");
            state.current = new Point(state.points[state.n].x, state.points[state.n].y, "", false);

            // Update the message to tell the user to press run
            updateInnerHtml(messageBox, "Press the 'Run' button to start the game!");
        }

        // Readjust the points
        /* IT IS IMPORTANT THAT THIS IS CALLED AFTER THE LABELS ARE CREATED SINCE IT MANIPULATES THOSE LABELS */
        /* If the game ends there are no labels, so do not readjust them either */
        if (state.points.length >= state.n && !flags.endGame) {
            readjustPoints(state.points, canvas, state.n);
        }

        /* Possible cases for which buttons should be enabled */
        // The game has ended
        if (flags.endGame) {
            disable(run);
            disable(undo);
            disable(redo);
            disable(playPause);
            disableCanvasEvents(canvas, update);
        // There are enough points and the user is running the game
        } else if (state.points.length >= state.n + 1 && flags.run) {
            disable(run);
            disable(undo);
            disable(redo);
            enable(playPause);
            disableCanvasEvents(canvas, update);
        // There are enough points but the user has yet to run the game (so you can still undo points)
        } else if (state.points.length === state.n + 1 && flags.run !== true) {
            enable(run);
            disable(redo);
            disable(playPause);
            disableCanvasEvents(canvas, update);
        // If we have no points to draw, disable
        } else if (state.points.length === 0) {
            if (state.undid.length !== 0) {
                enable(redo);
            } else {
                disable(redo);
            }
            disable(run);
            disable(undo);
            disable(playPause);
            enableCanvasEvents(canvas, update, state);
        // This situation occurs when the user is currently drawing
        } else {
            if (state.undid.length !== 0) {
                enable(redo);
            } else {
                disable(redo);
            }
            enable(undo);
            disable(run);
            disable(playPause);
            enableCanvasEvents(canvas, update, state);
        }

        // If the user presses the run button, run the game
        // The previous if/else-if statements verify that the game is in a runnable state
        if (flags.run) {
            if (!flags.endGame) {
                totalPoints[0].border = false;
                totalPoints[state.n + 1].border = false;
            }

            // Initialize the time variables to control the speed of point insertion
            let deltaTime = 0;
            let prevTime = deltaTime;
            deltaTime = Date.now() - prevTime;

            // Clear the undone points for the next game
            state.undid.length = 0;

            // Animation function to generate and draw a new point
            let animate = function () {

                // End game condition
                if (totalPoints.length - 1 >= config.TOTAL_POINTS) {
                    // End the game and update the last point generated to get rid of its border
                    flags.endGame = true;
                    totalPoints[totalPoints.length - state.n - 2].border = false;

                    // Also clear point data
                    state.points.length = 0;

                    // We need to do some quick changes when we end the game
                    // We need to update the user and clear the labels, as well as call update
                    // one last time to make sure that all the buttons are properly set
                    updateInnerHtml(messageBox, "Look at your fascinating fractal pattern! Press refresh or restart to play again!");
                    clearChildren(innerGame);
                    update();

                    // TO-DO for Kathlyn - insert the celebration gif and music here
                }

                // Update the time elapsed
                deltaTime = Date.now() - prevTime;

                // If the time elapsed has become greater than the speed
                // specified by the user, then generate a new point and draw it
                if (deltaTime > config.SPEED && !flags.endGame && config.PLAY) {
                    // Update previous time
                    prevTime = Date.now();

                    // Generate a random number
                    let rand = randomNumber(0, state.n - 1);

                    // Generate a point based on that number
                    state.current.border = false;
                    state.generatedPoints.push(generateFactorPoint(state.current, state.points[rand], state.n / (state.n + 3)));

                    // Insert it into the drawing vertices
                    totalPoints.splice(totalPoints.length - state.n - 1, 0, state.generatedPoints[state.generatedPoints.length - 1]);

                    // Update current vertex and label it
                    state.current = state.generatedPoints[state.generatedPoints.length - 1];
                    state.current.border = true;
                    addCustomLabel(state.current, canvas, "Current");

                    // Update the message to tell the user the random number and point chosen
                    updateInnerHtml(messageBox, "Random number chosen: " + rand + " Point Associated: " + String.fromCharCode(rand + 65));
                }

                // Draw
                drawVertices(webGL, totalPoints, hsvToRgb(config.COLOR / 360, 1.0, 1.0));

                // Update the number of points drawn (excluding the mouse position)
                updateInnerHtml(pointsPlaced, "Points: " + (totalPoints.length - 1));

                // Spawn the animation recursively using requestAnimationFrame
                cancelAnimationFrame(animID);
                animID = requestAnimationFrame(animate);
            }

            // IMPORTANT - we DO NOT want multiple animations occurring
            // This must be included here, so that only one animation is spawned
            // If this is not included, multiple animations will spawn, causing issues
            // That way we can control the speed of the only animation occurring
            if (flags.spawnAnimation === true) {
                animate();
                flags.spawnAnimation = false;
            }

        // If we are not running the game, bind and draw the current positions
        } else {
            // Draw
            drawVertices(webGL, totalPoints, hsvToRgb(config.COLOR / 360, 1.0, 1.0), state.n);
            // Update the number of points drawn
            if (totalPoints.length === 0)
                updateInnerHtml(pointsPlaced, "Points: " + totalPoints.length);
            else
                updateInnerHtml(pointsPlaced, "Points: " + (totalPoints.length - 1));
        }
    }
}

// Update the mouse position
function updateMousePosition(e, mousePosition, canvas) {
    let rect = e.target.getBoundingClientRect();
    mousePosition.x = 2 * (e.clientX - rect.left) / canvas.width - 1;
    mousePosition.y = - 2 * (e.clientY - rect.top) / canvas.height + 1;
}

// Resize the window
function resize(webGL, canvas, innerGame) {
    canvas.width = innerGame.getBoundingClientRect().width;
    canvas.height = innerGame.getBoundingClientRect().height;
    webGL.viewport(0, 0, canvas.width, canvas.height);
}

// Place points
function placePoint(e, mousePosition, points, canvas, undid) {
    // Clear the array
    /* For some odd reason JS requires that I change the attribute instead of the array */
    /* If I set it to an empty array it does nothing - possibly a pass-by-reference/value rule issue */
    undid.length = 0;

    let rect = e.target.getBoundingClientRect();
    mousePosition.x = 2 * (e.clientX - rect.left) / canvas.width - 1;
    mousePosition.y = - 2 * (e.clientY - rect.top) / canvas.height + 1;
    points.push(new Point(mousePosition.x, mousePosition.y, String.fromCharCode(points.length + 65), true));
}

// Remove points and label
function removePointAndLabel(points, undid, innerGame) {
    undid.push(points.pop());
    innerGame.removeChild(innerGame.lastChild);
}

// Redo point (the update function automatically adds labels)
function redoPoint(points, undid) {
    points.push(undid.pop());
}

// Create a new label
function newLabel(id, zIndex) {
    let p = document.createElement("p");

    p.id = id;
    p.style.zIndex = zIndex;
    p.style.position = "absolute";
    p.style.display = "inline";
    p.style.padding = "0";
    p.style.margin = "0";

    return p;
}

// Point labeling for initial points "A, B, C"
function addLabels(points, canvas) {
    for (let i = 0; i < points.length; i++) {
        let div = document.getElementById("inner_game");
        let label = document.getElementById("pointLabel" + i);

        // Find the center
        let center = new Point(canvas.width / 2, canvas.height / 2);
        // Find the position of the point in window coordinates
        let position = new Point(canvas.width * (points[i].x + 1) / 2, canvas.height * (points[i].y - 1) / (-2));
        // Find the direction we want the label to be in, which is relative to the center
        let direction = new Point(position.x - center.x, position.y - center.y);
        // Create a unit vector of that direction
        let unitVector = new Point(direction.x, direction.y);
        unitVector.unit();

        // Now find the final position
        // First we find the direction, add a certain amount of direction, and then translate it to be relative to the center
        let point = new Point(direction.x + 20 * unitVector.x + center.x, direction.y + 20 * unitVector.y + center.y);

        if (!label) {
            let p = newLabel("pointLabel" + i, i + "");
            let node = document.createTextNode(points[i].label);
            p.appendChild(node);
            p.style.top = div.getBoundingClientRect().top + window.scrollY + point.y - 10 + "px";
            p.style.left = div.getBoundingClientRect().left + point.x - 10 + "px";
            div.appendChild(p);
        } else {
            label.style.top = div.getBoundingClientRect().top + window.scrollY + point.y - 10 + "px";
            label.style.left = div.getBoundingClientRect().left + point.x - 10 + "px";
        }
    }
}

// Point labeling for starting vertex and current vertex
function addCustomLabel(labelPoint, canvas, labelMessage) {
    let div = document.getElementById("inner_game");
    let label = document.getElementById("customLabel");

    let position = new Point(canvas.width * (labelPoint.x + 1) / 2, canvas.height * (labelPoint.y - 1) / (-2));
    let direction = new Point(0.0, -1.0);

    let unitVector = new Point(direction.x, direction.y);
    unitVector.unit();

    let point = new Point(direction.x + unitVector.x + position.x, direction.y + unitVector.y + position.y);

    if (!label) {
        let p = newLabel("customLabel", "10");
        let node = document.createTextNode(labelMessage);
        p.appendChild(node);
        p.style.top = div.getBoundingClientRect().top + window.scrollY + point.y  - 20 + "px";
        p.style.left = div.getBoundingClientRect().left + point.x - 20 + "px";
        div.appendChild(p);
    } else {
        label.innerHTML = labelMessage;
        label.style.top = div.getBoundingClientRect().top + window.scrollY + point.y - 20 + "px";
        label.style.left = div.getBoundingClientRect().left + point.x - 20 + "px";
    }
}

// Clear the children elements - used to clear labels here
// Based off of this code: https://stackoverflow.com/questions/19885788/removing-every-child-element-except-first-child
function clearChildren(div) {
    while (div.children.length > 1) {
        div.removeChild(div.lastChild);
    }
}


// HSV to RGB color conversion
// Based off of this code: https://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c
/**
 * Converts an HSV color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes h, s, and v are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 */
function hsvToRgb(h, s, v){
    var r, g, b;

    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);

    switch(i % 6){
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return new Color(r * 255, g * 255, b * 255);
}

// Calculate the new center and readjust the points accordingly
// TO-DO: if the user chooses points that are close to each other or are in a line, issues occur
// Therefore, we might have to do some checking before actually applying this function
// OF NOTE - this works using screen space instead of webGL coordinates - otherwise it gets stretched
function readjustPoints(points, canvas, n) {
    let div = document.getElementById("inner_game");
    let sum = [0, 0];
    for (let i = 0; i < points.length && i < n; i++) {
        sum[0] += points[i].x;
        sum[1] += points[i].y;
    }
    sum[0] /= n;
    sum[1] /= n;
    for (let i = 0; i < points.length && i < n; i++) {
        let screenSpaceX =   canvas.width * (points[i].x + 1) / 2;
        let screenSpaceY = -canvas.height * (points[i].y - 1) / 2;

        let screenCenterX =   canvas.width * (sum[0] + 1) / 2;
        let screenCenterY = -canvas.height * (sum[1] - 1) / 2;
        let dir = [
            screenSpaceX - screenCenterX,
            screenSpaceY - screenCenterY
        ];
        let unitVec = [
            dir[0] / Math.sqrt( dir[0]**2 + dir[1]**2 ),
            dir[1] / Math.sqrt( dir[0]**2 + dir[1]**2 )
        ]
        let point = [
            dir[0] + 30 * unitVec[0] + screenCenterX,
            dir[1] + 30 * unitVec[1] + screenCenterY
        ];

        let label = document.getElementById("pointLabel" + i);
        if (label) {
            label.style.top = div.getBoundingClientRect().top + window.scrollY + (point[1]) - 10 + "px";
            label.style.left = div.getBoundingClientRect().left + (point[0]) - 10 + "px";
        } else {
            console.log("label does not exist");
        }
    }
}

// A function used draw a set of points of a certain color
function drawVertices(webGL, pointArray, color) {
    let vertexArray = [];
    let borderArray = [];
    for (let i = 0; i < pointArray.length; i++) {
        if (pointArray[i].border) {
            vertexArray.push(pointArray[i].x);
            vertexArray.push(pointArray[i].y);
            vertexArray.push(pointArray[i].x);
            vertexArray.push(pointArray[i].y);
            borderArray.push(1.0);
            borderArray.push(0.0);
        } else {
            vertexArray.push(pointArray[i].x);
            vertexArray.push(pointArray[i].y);
            borderArray.push(0.0);
        }
    }

    let a_Position = webGL.getAttribLocation(webGL.program, "a_Position");
    let a_border = webGL.getAttribLocation(webGL.program, "a_border");
    let u_Color = webGL.getUniformLocation(webGL.program, "u_Color");
    let u_pointSize = webGL.getUniformLocation(webGL.program, "u_pointSize");

    let data = new Float32Array(vertexArray);
    let vertexBuffer = webGL.createBuffer();
    webGL.bindBuffer(webGL.ARRAY_BUFFER, vertexBuffer);
    webGL.bufferData(webGL.ARRAY_BUFFER, data, webGL.STATIC_DRAW);
    webGL.vertexAttribPointer(a_Position, 2, webGL.FLOAT, false, 0, 0);
    webGL.enableVertexAttribArray(a_Position);

    let borderData = new Float32Array(borderArray);
    let borderBuffer = webGL.createBuffer();
    webGL.bindBuffer(webGL.ARRAY_BUFFER, borderBuffer);
    webGL.bufferData(webGL.ARRAY_BUFFER, borderData, webGL.STATIC_DRAW);
    webGL.vertexAttribPointer(a_border, 1, webGL.FLOAT, false, 0, 0);
    webGL.enableVertexAttribArray(a_border);

    webGL.uniform1f(u_pointSize, 8.0);
    webGL.uniform4f(u_Color, color.r / 255,  color.g / 255, color.b / 255, 1.0);

    webGL.clear(webGL.COLOR_BUFFER_BIT);
    webGL.drawArrays(webGL.POINTS, 0, vertexArray.length / 2);
}

// A function to enable canvas events
// This is done to enable user drawing
function enableCanvasEvents(canvas, update, state) {
    // When the user mouses over the canvas, update the mouse position and render
    canvas.onmousemove = function (e) {
        updateMousePosition(e, state.mousePosition, canvas);
        update();
    }

    // If the user mouses out, put the mouse in an unviewable position and render
    canvas.onmouseout = function () {
        // NOTE - JS is pass-by-value if you reassign a variable to another
        // To actually modify the variable, you need to edit its attributes
        state.mousePosition.x = 2.0;
        state.mousePosition.y = 2.0;
        update();
    }

    // If the user clicks on the canvas, add a point to the point array
    canvas.onclick = function (e) {
        placePoint(e, state.mousePosition, state.points, canvas, state.undid);
        update();
    }
}

// Disabling the canvas events
// This is done to disable user drawing
function disableCanvasEvents(canvas, update) {
    canvas.onmousemove = update;
    canvas.onmouseout = update;
    canvas.onclick = update;
}

// Enable a button
function enable(domElement) {
    domElement.disabled = false;
    domElement.style.opacity = "1.0";
}

// Disable a button
function disable(domElement) {
    domElement.disabled = true;
    domElement.style.opacity = "0.5";
}

// Update messages
function updateInnerHtml(domElement, message) {
    domElement.innerHTML = "<span>" + message + "</span>";
}

// Generate a new point that is a certain factor
// from the original point going towards the destination
function generateFactorPoint(ori, dest, factor) {
    return new Point((dest.x - ori.x) * factor + ori.x, (dest.y - ori.y) * factor + ori.y);
}

// Generate random number
function randomNumber(lower, upper) {
    return Math.floor(Math.random() * (upper - lower + 1) + lower);
}