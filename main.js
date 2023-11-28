import WindowManager from './WindowManager.js'



const t = THREE;
let camera, scene, renderer, world;
let near, far;
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1;
// let spheres = [];
let spheres = [];
let markers = [];
let lines = [];
let sceneOffsetTarget = {x: 0, y: 0};
let sceneOffset = {x: 0, y: 0};

let today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);
today = today.getTime();

let internalTime = getTime();
let windowManager;
let initialized = false;

// get time in seconds since beginning of the day (so that all windows use the same time)
function getTime ()
{
	return (new Date().getTime() - today) / 1000.0;
}


if (new URLSearchParams(window.location.search).get("clear"))
{
	localStorage.clear();
}
else
{
	// this code is essential to circumvent that some browsers preload the content of some pages before you actually hit the url
	document.addEventListener("visibilitychange", () =>
	{
		if (document.visibilityState != 'hidden' && !initialized)
		{
			init();
		}
	});

	window.onload = () => {
		if (document.visibilityState != 'hidden')
		{
			init();
		}
	};

	function init ()
	{
		initialized = true;

		// add a short timeout because window.offsetX reports wrong values before a short period
		setTimeout(() => {
			setupScene();
			setupWindowManager();
			resize();
			updateWindowShape(false);
			render();
			window.addEventListener('resize', resize);
		}, 500)
	}

	function setupScene ()
	{
		camera = new t.OrthographicCamera(0, 0, window.innerWidth, window.innerHeight, -10000, 10000);

		camera.position.z = 2.5;
		near = camera.position.z - .5;
		far = camera.position.z + 0.5;

		scene = new t.Scene();
		scene.background = new t.Color(0.0);
		scene.add( camera );

		renderer = new t.WebGLRenderer({antialias: true, depthBuffer: true});
		renderer.setPixelRatio(pixR);

	  	world = new t.Object3D();
		scene.add(world);

		renderer.domElement.setAttribute("id", "scene");
		document.body.appendChild( renderer.domElement );
	}

	function setupWindowManager ()
	{
		windowManager = new WindowManager();
		windowManager.setWinShapeChangeCallback(updateWindowShape);
		windowManager.setWinChangeCallback(windowsUpdated);

		// here you can add your custom metadata to each windows instance
		let metaData = {foo: "bar"};

		// this will init the windowmanager and add this window to the centralised pool of windows
		windowManager.init(metaData);

		// call update windows initially (it will later be called by the win change callback)
		windowsUpdated();
	}

	function windowsUpdated ()
	{
		updateNumberOfSpheres();
	}
	function updateNumberOfSpheres() {
		let wins = windowManager.getWindows();

		// remove all spheres and markers
		spheres.forEach((s) => {
			world.remove(s);
		});
		markers.forEach((m) => {
			world.remove(m);
		});
		lines.forEach((l) => {
			world.remove(l);
		});

		// add new spheres and markers based on the current window setup
		for (let i = 0; i < wins.length; i++) {
			let win = wins[i];

			let c = new t.Color();
			c.setHSL(i * 0.1, 1.0, 0.5);

			let radius = 50 + i * 25;
			let sphere = new t.Mesh(
				new t.SphereGeometry(radius, 32, 32),
				new t.MeshBasicMaterial({ color: c, wireframe: true })
			);
			sphere.position.x = win.shape.x + win.shape.w * 0.5;
			sphere.position.y = win.shape.y + win.shape.h * 0.5;

			let marker = new t.Mesh(
				new t.SphereGeometry(5, 16, 16),
				new t.MeshBasicMaterial({ color: c })
			);
			marker.position.copy(sphere.position);

			world.add(sphere);
			world.add(marker);
			spheres.push(sphere);
			markers.push(marker);
		}

		// connect spheres with lines
		for (let i = 0; i < spheres.length; i++) {
			for (let j = i + 1; j < spheres.length; j++) {
				let start = spheres[i].position;
				let end = spheres[j].position;

				let material = new t.LineBasicMaterial({
					linewidth: 5,
					vertexColors: t.VertexColors,
				});

				let geometry = new t.Geometry();
				geometry.vertices.push(start, end);

				let colorStart = spheres[i].material.color.clone();
				let colorEnd = spheres[j].material.color.clone();
				let colors = [colorStart, colorEnd];

				geometry.colors = colors;

				let line = new t.Line(geometry, material);
				world.add(line);
				lines.push(line);
			}
		}
	}

	function updateNumberOfCubes ()
	{
		let wins = windowManager.getWindows();

		// remove all spheres
		spheres.forEach((c) => {
			world.remove(c);
		})

		spheres = [];

		// add new spheres based on the current window setup
		for (let i = 0; i < wins.length; i++)
		{
			let win = wins[i];

			let c = new t.Color();
			c.setHSL(i * .1, 1.0, .5);

			let s = 100 + i * 50;
			let cube = new t.Mesh(new t.BoxGeometry(s, s, s), new t.MeshBasicMaterial({color: c , wireframe: true}));
			cube.position.x = win.shape.x + (win.shape.w * .5);
			cube.position.y = win.shape.y + (win.shape.h * .5);

			world.add(cube);
			spheres.push(cube);
		}
	}

	function updateWindowShape (easing = true)
	{
		// storing the actual offset in a proxy that we update against in the render function
		sceneOffsetTarget = {x: -window.screenX, y: -window.screenY};
		if (!easing) sceneOffset = sceneOffsetTarget;
	}


	function render ()
	{
		let t = getTime();

		windowManager.update();


		// calculate the new position based on the delta between current offset and new offset times a falloff value (to create the nice smoothing effect)
		let falloff = .05;
		sceneOffset.x = sceneOffset.x + ((sceneOffsetTarget.x - sceneOffset.x) * falloff);
		sceneOffset.y = sceneOffset.y + ((sceneOffsetTarget.y - sceneOffset.y) * falloff);

		// set the world position to the offset
		world.position.x = sceneOffset.x;
		world.position.y = sceneOffset.y;

		let wins = windowManager.getWindows();


		// loop through all our spheres and update their positions based on current window positions
		for (let i = 0; i < spheres.length; i++)
		{
			let cube = spheres[i];
			let win = wins[i];
			let _t = t;// + i * .2;

			let posTarget = {x: win.shape.x + (win.shape.w * .5), y: win.shape.y + (win.shape.h * .5)}

			cube.position.x = cube.position.x + (posTarget.x - cube.position.x) * falloff;
			cube.position.y = cube.position.y + (posTarget.y - cube.position.y) * falloff;
			cube.rotation.x = _t * .5;
			cube.rotation.y = _t * .3;

			let marker = markers[i];
			marker.position.copy(cube.position);

			if (i < lines.length) {
				let line = lines[i];
				let nextSphere = cube[i + 1];

				if (nextSphere) {
					let start = cube.position.clone();
					let end = nextSphere.position.clone();

					line.geometry.vertices[0] = start;
					line.geometry.vertices[1] = end;
					line.geometry.verticesNeedUpdate = true;
				}
			}
		}

		renderer.render(scene, camera);
		requestAnimationFrame(render);
	}


	// resize the renderer to fit the window size
	function resize ()
	{
		let width = window.innerWidth;
		let height = window.innerHeight

		camera = new t.OrthographicCamera(0, width, 0, height, -10000, 10000);
		camera.updateProjectionMatrix();
		renderer.setSize( width, height );
	}
}
