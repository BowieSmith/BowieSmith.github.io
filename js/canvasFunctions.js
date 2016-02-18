var canvas = document.getElementById("canvas");
canvas.height = 350;
canvas.width = 350;
var cxt = canvas.getContext("2d");

(function createActionButtons() {
  var actionObjects = [{
    name: "Clear Canvas",
    action: clearCanvas
  }, {
    name: "Squares on Squares",
    action: randomSquares
  }, {
    name: "Random Walk",
    action: randomWalk
  }, {
    name: "Bezier Bomb",
    action: bezierBomb
  }, {
    name: "Chaos Game",
    action: chaosGame
  }, {
    name: "Circles in Circles",
    action: circlesInCircles
  }];
  
  actionObjects.forEach(function(button) {
    var newButton = document.createElement("li");
    newButton.textContent = button.name;
    newButton.addEventListener("click", button.action);
    document.getElementById("buttonContainer").appendChild(newButton);
  });
})();

function clearCanvas() {
  cxt.clearRect(0, 0, canvas.width, canvas.height);
  document.getElementById("context").textContent = '"Nothingness Nothings." --Martin Heidegger';
}

function randomSquares() {
  function step() {
    cxt.fillStyle = "#" + (Math.ceil(Math.random() * Math.pow(2, 24))).toString(16);
    cxt.fillRect(Math.ceil(Math.random() * canvas.width - 50), Math.ceil(Math.random() * canvas.height - 50),
      Math.random() * canvas.width / 3, Math.random() * canvas.height / 3);
    myReq = requestAnimationFrame(step);
  }
  var myReq = requestAnimationFrame(step);
  setTimeout(function() {
    cancelAnimationFrame(myReq);
  }, 5000);
  document.getElementById("context").textContent = '"To excite in us tastes, odors, and sounds I believe that nothing is required in external bodies except shapes, numbers, and slow or rapid movements... if ears, tongues, and noses were removed, shapes and numbers would remain, but not odors or tastes or sounds." --Galileo Galilei';
}

function randomWalk() {
  var x = canvas.width / 2,
      y = canvas.height / 2;
  cxt.beginPath();
  cxt.moveTo(x, y);
  
  function step() {
    cxt.strokeStyle = "#" + (Math.ceil(Math.random() * Math.pow(2, 24))).toString(16);
    var ran = Math.ceil(Math.random() * 4) % 4;
    var lineSize = Math.random() * 20;
    if (ran === 0) {
      x += lineSize;
    } else if (ran === 1) {
      y += lineSize;
    } else if (ran === 2) {
      x += lineSize * -1;
    } else if (ran === 3) {
      y += linieSize * -1;
    }
    cxt.lineTo(x, y);
    cxt.stroke();
    myReq = requestAnimationFrame(step);
  }
  var myReq = requestAnimationFrame(step);
  setTimeout(function() {
    cancelAnimationFrame(myReq);
  }, 5000);
  document.getElementById("context").textContent = '"Goals transform a random walk into a chase." --Mihaly Csikszentmihalyi';
}

function bezierBomb() {
  cxt.lineWidth = 2;
  
  function step() {
    cxt.strokeStyle = "#" + (Math.ceil(Math.random() * Math.pow(2, 24))).toString(16);
    cxt.beginPath();
    cxt.moveTo(canvas.width / 2, canvas.height / 2);
    var w = Math.random() * canvas.height,
        x = Math.random() * canvas.height,
        y = Math.random() * canvas.height,
        z = Math.random() * canvas.height,
        a = Math.random() * canvas.height,
        b = Math.random() * canvas.height;
      //control1=(10,10) control2=(90,10) control3=(50,90)
    cxt.bezierCurveTo(w, x, y, z, a, b);
    cxt.stroke();
    
    myReq = requestAnimationFrame(step);
  }
  var myReq = requestAnimationFrame(step);
  setTimeout(function() {
    cancelAnimationFrame(myReq);
  }, 5000);
  document.getElementById("context").textContent = '"Is imagination not based partly on the ability to connect notions which, at first sight, look quite unrelated, such as mechanics, electronics, optics, chemistry, foundry and data processing? Is it related to the sense of humor that can detect unexpected relationships between facts that look quite unconnected?" --Pierre Bezier';
}

function chaosGame() {
  var x = [0, canvas.height - 10],
      y = [canvas.width, canvas.height - 10],
      z = [canvas.width / 2, 0],
      a = [Math.random() * canvas.width, Math.random() * canvas.height];
  
  function step() {
    cxt.fillStyle = "#" + (Math.ceil(Math.random() * Math.pow(2, 24))).toString(16);
    cxt.fillRect(a[0], a[1], 2, 2);
    var ran = Math.ceil(Math.random() * 3);
    if (ran === 1) {
      a[0] = (a[0] + x[0]) / 2;
      a[1] = (a[1] + x[1]) / 2;
    } else if (ran === 2) {
      a[0] = (a[0] + y[0]) / 2;
      a[1] = (a[1] + y[1]) / 2;
    } else {
      a[0] = (a[0] + z[0]) / 2;
      a[1] = (a[1] + z[1]) / 2;
    }
    myReq = requestAnimationFrame(step);
  }
  var myReq = requestAnimationFrame(step);
  setTimeout(function() {
    cancelAnimationFrame(myReq);
  }, 100000);
  document.getElementById("context").textContent ='"One must still have chaos in oneself to be able to give birth to a dancing star." --Frederick Nietzsche';
}

function circlesInCircles() {
  function step() {
    cxt.strokeStyle = "#" + (Math.ceil(Math.random() * Math.pow(2, 24))).toString(16);
    cxt.beginPath();
    cxt.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 50,
      Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    cxt.stroke();
    myReq = requestAnimationFrame(step);
  }
  var myReq = requestAnimationFrame(step);
  setTimeout(function() {
    cancelAnimationFrame(myReq);
  }, 5000);
  document.getElementById("context").textContent = '"The life of man is a self-evolving circle, which, from a ring imperceptibly small, rushes on all sides outwards to new and larger circles, and that without end. The extent to which this generation of circles, wheel without wheel, will go, depends on the force or truth of the individual soul." --Ralph Waldo Emerson';
}

(function mouseTrail() {
  var points = [];
  for (var i = 0; i < 10; i++) {
    var newPoint = document.createElement("div");
    newPoint.className = "trail";
    document.body.appendChild(newPoint);
    points.push(newPoint);
  };
  
  var currentPoint = 0;
  
  addEventListener("mousemove", function(event) {
    var point = points[currentPoint];
    point.style.background = "#" + (Math.ceil(Math.random() * Math.pow(2, 24))).toString(16);
    point.style.left = event.pageX - 10 + "px";
    point.style.right = event.pageY - 10 + "px";
    currentPoint = (currentPoint + 1) % points.length;
  });
})();
