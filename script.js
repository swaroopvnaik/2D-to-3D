
const drawCanvas = document.getElementById('drawCanvas');
const colorPicker = document.getElementById('colorPicker');
const depthInput = document.getElementById('depth');
const convertTo3DButton = document.getElementById('convertTo3D');
const imageUpload = document.getElementById('imageUpload');
const addImagesTo3DButton = document.getElementById('addImagesTo3D');

drawCanvas.width = window.innerWidth / 2;
drawCanvas.height = window.innerHeight;
const ctx = drawCanvas.getContext('2d');
let isDrawing = false;
let points = [];

// Pencil color
let currentColor = colorPicker.value;
colorPicker.addEventListener('input', () => {
    currentColor = colorPicker.value;
    ctx.strokeStyle = currentColor;
});

// Drawing on canvas
drawCanvas.addEventListener('mousedown', (event) => {
    isDrawing = true;
    points = [];
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(event.offsetX, event.offsetY);
    points.push({ x: event.offsetX - drawCanvas.width / 2, y: event.offsetY - drawCanvas.height / 2 });
});

drawCanvas.addEventListener('mousemove', (event) => {
    if (isDrawing) {
        ctx.lineTo(event.offsetX, event.offsetY);
        ctx.stroke();
        points.push({ x: event.offsetX - drawCanvas.width / 2, y: event.offsetY - drawCanvas.height / 2 });
    }
});

drawCanvas.addEventListener('mouseup', () => {
    isDrawing = false;
});

// Setup the 3D scene
const container = document.getElementById('3dContainer');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth / 2, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, (window.innerWidth / 2) / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 50);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.update();

window.addEventListener('resize', () => {
    drawCanvas.width = window.innerWidth / 2;
    drawCanvas.height = window.innerHeight;
    renderer.setSize(window.innerWidth / 2, window.innerHeight);
    camera.aspect = (window.innerWidth / 2) / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Create 3D Shape from 2D Canvas drawing
function createSmooth3DShape(points, depth) {
    const curve = new THREE.CatmullRomCurve3(
        points.map(p => new THREE.Vector3(p.x, -p.y, 0)),
        true
    );

    const shapePoints = curve.getPoints(50);
    const shape = new THREE.Shape();
    shape.moveTo(shapePoints[0].x, shapePoints[0].y);

    shapePoints.forEach(p => {
        shape.lineTo(p.x, p.y);
    });

    const extrudeSettings = {
        steps: 2,
        depth: depth,
        bevelEnabled: true,
        bevelThickness: 1,
        bevelSize: 1,
        bevelSegments: 1
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    const material = new THREE.MeshNormalMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
}

convertTo3DButton.addEventListener('click', () => {
    if (points.length > 2) {
        const depth = parseInt(depthInput.value);
        createSmooth3DShape(points, depth);
    } else {
        alert('Please draw a shape first.');
    }
});

// Convert uploaded PNG images to 3D
function convertImageTo3D(image) {
    const texture = new THREE.Texture(image);
    texture.needsUpdate = true;

    const width = image.width;
    const height = image.height;

    const geometry = new THREE.PlaneGeometry(width, height, width, height);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        wireframe: false
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = - Math.PI / 2; // Lay the image flat

    scene.add(plane);
}

// Handle image upload
addImagesTo3DButton.addEventListener('click', () => {
    const files = imageUpload.files;
    if (files.length === 0) {
        alert('Please upload at least one image.');
        return;
    }

    Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.src = reader.result;
            img.onload = () => {
                convertImageTo3D(img);
            };
        };
        reader.readAsDataURL(file);
    });
});

// Animate the 3D scene
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();
