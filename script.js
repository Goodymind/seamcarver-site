const upload = document.getElementById("imageUpload");
const image = new Image();
const resizer = document.getElementById("resizer");

const canvas = document.getElementById("imageCanvas");
const ctx = canvas.getContext("2d");

const rightHandle = document.querySelector(".right");
const bottomHandle = document.querySelector(".bottom");
const cornerHandle = document.querySelector(".corner");

const button = document.getElementById("download");

var data;
let targetWidth;
let carving = false;
let scale;

function wrap(i, a, b) {
    if (b < i) {
        i = a + i - (b);
    }
    if (i < a) {
        i = (b) - (a - i);
    }
    return i;
}

function lt(a, b) {
    if (b == -1) return true;
    return a < b;
}


// for specific pixel only
function pxI(x, y) {
    x = wrap(x, 0, canvas.width);
    y = wrap(y, 0, canvas.height);
    return y * canvas.width + x;
}

// for rgba data
function px(x, y) {
    return pxI(x, y) * 4;
}


function getEnergy(i, j) {


    const i0 = (i - 1 + canvas.width) % canvas.width;
    const i2 = (i + 1 + canvas.width) % canvas.width;
    const j0 = (j - 1 + canvas.height) % canvas.height;
    const j2 = (j + 1 + canvas.height) % canvas.height;

    const xr = data[px(i0, j)] - data[px(i2, j)];
    const xg = data[px(i0, j) + 1] - data[px(i2, j) + 1];
    const xb = data[px(i0, j) + 2] - data[px(i2, j) + 2];
    const xa = data[px(i0, j) + 3] - data[px(i2, j) + 3];

    const yr = data[px(i, j0)] - data[px(i, j2)];
    const yg = data[px(i, j0) + 1] - data[px(i, j2) + 1];
    const yb = data[px(i, j0) + 2] - data[px(i, j2) + 2];
    const ya = data[px(i, j0) + 3] - data[px(i, j2) + 3];


    const x = (xr * xr) + (xg * xg) + (xb * xb);
    const y = (yr * yr) + (yg * yg) + (yb * yb);
    return x + y;
}

function findVerticalSeam() {

    const costs = new Float32Array(canvas.width * canvas.height);

    function smallest_triple(i, j) {
        // returns smallest between x-1, x, and x in given y
        const i0 = Math.max(i - 1, 0);
        const i2 = Math.min(i + 1, canvas.width - 1);
        const mid = costs[pxI(i, j)];
        const left = costs[pxI(i0, j)];
        const right = costs[pxI(i2, j)];

        if (left < mid && left < right) return i0;
        if (mid < left && mid < right) return i;
        if (right < left && right < mid) return i2;
        if (left == right && left < mid) return i2;
        return i;
    }
    // get costs
    for (let j = 0; j < canvas.height; j++) {
        for (let i = 0; i < canvas.width; i++) {
            if (j == 0) {
                costs[pxI(i, j)] = getEnergy(i, j);
            }
            else {
                const smallest_i = smallest_triple(i, j - 1);
                costs[pxI(i, j)] = getEnergy(i, j) + costs[pxI(smallest_i, j - 1)];
            }

        }
    }

    const path = new Float32Array(canvas.height);

    let smallest = -1;
    let smallest_cost_i = 0;
    for (let i = 0; i < canvas.width; i++) {
        let current = costs[pxI(i, canvas.height - 1)];
        if (lt(current, smallest)) {
            smallest = current;
            smallest_cost_i = i;
        }
    }

    for (let j = canvas.height - 1; j >= 0; j--) {
        smallest_cost_i = smallest_triple(smallest_cost_i, j);
        path[j] = smallest_cost_i;

    }
    return path;
}


function removeVerticalSeam(seam) {
    const newWidth = canvas.width - 1;

    for (let j = 0; j < canvas.height; j++) {
        const seamX = seam[j];
        data.copyWithin(
            px(seamX, j),
            px(seamX + 1, j),
            j < canvas.height - 1 ? px(0, j + 1) : canvas.width * canvas.height * 4
        );
    }

    // rebuild data with new width
    const newData = new Uint8ClampedArray(newWidth * canvas.height * 4);
    for (let j = 0; j < canvas.height; j++) {
        const srcStart = j * canvas.width * 4;
        const dstStart = j * newWidth * 4;
        newData.set(data.subarray(srcStart, srcStart + newWidth * 4), dstStart);
    }

    canvas.width = newWidth;
    data = newData;

    const imageData = new ImageData(data, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);
}

upload.addEventListener("change", () => {

    const file = upload.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {

        image.src = e.target.result;

        image.onload = () => {
            const maxWidth = window.innerWidth * 0.8;
            scale = image.width > maxWidth ? maxWidth / image.width : 1;

            // resizer.style.scale = scale;
            canvas.style.transform = "scale(" + scale + ")";
            canvas.style.transformOrigin = "top left";

            resizer.classList.add("inline-block");
            resizer.classList.remove("hidden");

            resizer.style.width = image.width * scale + "px";
            resizer.style.height = image.height * scale + "px";
            resizer.width = image.width * scale;
            resizer.height = image.height * scale;
            targetWidth = image.width;

            canvas.width = image.width;
            canvas.height = image.height;


            
            ctx.drawImage(image, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            data = imageData.data;
            button.classList.add("block");
            button.classList.remove("hidden");
        };

    };

    reader.readAsDataURL(file);


});


function carveStep() {
    const seam = findVerticalSeam();
    removeVerticalSeam(seam);

    if (canvas.width > targetWidth) {
        requestAnimationFrame(carveStep);
    }
    else {
        carving = false;
    }
}

function startResize(e, direction) {


    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;

    const startWidth = resizer.offsetWidth;
    const startHeight = resizer.offsetHeight;


    function resize(e) {

        if (direction === "right" || direction === "corner") {
            resizer.style.width =
                startWidth + (e.clientX - startX) + "px";
        }

        if (direction === "bottom" || direction === "corner") {
            resizer.style.height =
                startHeight + (e.clientY - startY) + "px";
        }

    }

    function stopResize() {
        window.removeEventListener("mousemove", resize);
        window.removeEventListener("mouseup", stopResize);

        if (resizer.offsetWidth > startWidth || carving) {
            resizer.style.width = startWidth + "px";
            return;
        }

        if (startWidth > resizer.offsetWidth) {
            targetWidth = Math.round(resizer.offsetWidth / scale);
            carving = true;
            requestAnimationFrame(carveStep);
        }

    }

    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResize);

}

function startResizeTouch(e, direction) {
    e.preventDefault();

    for (const touch of e.changedTouches) {
        const startX = touch.clientX;
        const startY = touch.clientY;
        const startWidth = resizer.offsetWidth;
        const startHeight = resizer.offsetHeight;

        function resize(e) {
            for (const touch of e.changedTouches) {
                if (direction === "right" || direction === "corner") {
                    resizer.style.width =
                        startWidth + (touch.clientX - startX) + "px";
                }
                if (direction === "bottom" || direction === "corner") {
                    resizer.style.height =
                        startHeight + (touch.clientY - startY) + "px";
                }
            }
        }
        function stopResize() {
            window.removeEventListener("touchmove", resize);
            window.removeEventListener("touchend", stopResize);

            if (resizer.offsetWidth > startWidth || carving) {
                resizer.style.width = startWidth + "px";
                return;
            }

            if (startWidth > resizer.offsetWidth) {
                targetWidth = Math.round(resizer.offsetWidth  / scale);
                carving = true;
                requestAnimationFrame(carveStep);
            }
        }

        window.addEventListener("touchmove", resize);
        window.addEventListener("touchend", stopResize);
    }
}

function saveImage() {
    if (carving)
    {
        alert("Still carving!");
        return;
    }
    const link = document.createElement('a');
    link.download = "seamcarver-alinus";
    link.href = canvas.toDataURL('image/png');
    link.click();
}

rightHandle.addEventListener("mousedown", (e) => startResize(e, "right"));
rightHandle.addEventListener("touchstart", (e) => startResizeTouch(e, "right"), { passive: false });
// bottomHandle.addEventListener("mousedown", (e) => startResize(e, "bottom"));
// cornerHandle.addEventListener("mousedown", (e) => startResize(e, "corner"));
download.addEventListener("click", saveImage);
