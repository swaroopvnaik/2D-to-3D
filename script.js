const drawCanvas = document.getElementById('drawCanvas');
const colorPicker = document.getElementById('colorPicker');
const depthInput = document.getElementById('depth');
const convertTo3DButton = document.getElementById('convertTo3D');
const imageUpload = document.getElementById('imageUpload');
const addImagesTo3DButton = document.getElementById('addImagesTo3D');
const clearButton = document.getElementById('clearButton');
const downloadButton = document.getElementById('downloadButton');

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

    // Store the image data URL with the mesh
    plane.userData.imageData = getImageDataUrl(image);

    scene.add(plane);
}

// Function to convert image to data URL
function getImageDataUrl(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
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

// Clear both 2D canvas and 3D scene
clearButton.addEventListener('click', () => {
    // Clear 2D canvas
    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    points = [];

    // Clear 3D scene
    while(scene.children.length > 0){ 
        scene.remove(scene.children[0]); 
    }
});

// Generate interactive HTML file
function generateInteractiveHTML() {
    const threeJSCode = `
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        camera.position.set(0, 20, 50);
        controls.update();

        ${scene.children.map(child => {
            if (child instanceof THREE.Mesh) {
                const geometry = child.geometry;
                const material = child.material;
                let materialCode = '';
                if (material instanceof THREE.MeshNormalMaterial) {
                    materialCode = 'new THREE.MeshNormalMaterial()';
                } else if (material instanceof THREE.MeshBasicMaterial && material.map) {
                    materialCode = `new THREE.MeshBasicMaterial({
                        map: new THREE.TextureLoader().load('${child.userData.imageData}'),
                        side: THREE.DoubleSide
                    })`;
                }
                return `
                    const geometry${child.id} = new THREE.BufferGeometry();
                    geometry${child.id}.setAttribute('position', new THREE.Float32BufferAttribute(${JSON.stringify(Array.from(geometry.attributes.position.array))}, 3));
                    geometry${child.id}.setAttribute('normal', new THREE.Float32BufferAttribute(${JSON.stringify(Array.from(geometry.attributes.normal.array))}, 3));
                    const material${child.id} = ${materialCode};
                    const mesh${child.id} = new THREE.Mesh(geometry${child.id}, material${child.id});
                    mesh${child.id}.position.set(${child.position.x}, ${child.position.y}, ${child.position.z});
                    mesh${child.id}.rotation.set(${child.rotation.x}, ${child.rotation.y}, ${child.rotation.z});
                    scene.add(mesh${child.id});
                `;
            }
        }).join('\n')}

        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    `;

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Interactive 3D Scene</title>
            <style>
                body { margin: 0; }
                canvas { display: block; }
            </style>
        </head>
        <body>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
            <script>
                ${threeJSCode}
            </script>
        </body>
        </html>
    `;

    return htmlContent;
}

// Download interactive 3D scene
downloadButton.addEventListener('click', () => {
    const htmlContent = generateInteractiveHTML();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'interactive_3d_scene.html';
    link.click();
});

// Animate the 3D scene
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();

