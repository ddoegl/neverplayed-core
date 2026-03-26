/**
 * License 3D Visualization Experiment
 * Logic externalized from licenses.html
 */

globalThis.License3D = {
    state: null,

    init(container, parsedLicenses, _onRebuildRequest) {
        console.log('3D Init triggered');
        
        this.state = globalThis.__threeExperimentState = globalThis.__threeExperimentState || {
            renderer: null,
            scene: null,
            camera: null,
            animationId: null,
            raycaster: new THREE.Raycaster(),
            mouse: new THREE.Vector2(),
            isDragging: false,
            lastMousePos: { x: 0, y: 0 },
            targetRotation: { theta: 0, phi: Math.PI / 2.5 },
            targetZoom: 40,
            currentZoom: 60,
            lookAt: new THREE.Vector3(0, 0, 0),
            targetLookAt: new THREE.Vector3(0, 0, 0),
            hoveredObject: null
        };

        if (this.state.renderer) {
            console.log('3D Renderer already exists');
            return;
        }

        if (!container) {
            console.error('3D Container not found');
            return;
        }

        console.log('Setting up Three.js universe...', container.clientWidth, container.clientHeight);
        const state = this.state;
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x0a0a1a);
        
        const width = container.clientWidth || 1000;
        const height = container.clientHeight || 600;
        
        state.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        state.renderer.setSize(width, height);
        
        state.renderer.domElement.style.position = 'absolute';
        state.renderer.domElement.style.top = '0';
        state.renderer.domElement.style.left = '0';
        state.renderer.domElement.style.zIndex = '0';
        state.renderer.domElement.style.pointerEvents = 'auto';
        
        container.insertBefore(state.renderer.domElement, container.firstChild);

        state.camera.position.z = state.currentZoom;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        state.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(10, 10, 10);
        state.scene.add(pointLight);

        // Interaction Listeners
        state.onMouseDown = (e) => {
            state.isDragging = true;
            state.lastMousePos = { x: e.clientX, y: e.clientY };

            const rect = container.getBoundingClientRect();
            state.mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
            state.mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;
            state.raycaster.setFromCamera(state.mouse, state.camera);
            
            const intersects = state.raycaster.intersectObjects(state.scene.children, true);
            const licenseHit = intersects.find(hit => {
                let p = hit.object;
                while(p && !p.userData.isLicense) p = p.parent;
                return p;
            });

            if (licenseHit) {
                let p = licenseHit.object;
                while(p && !p.userData.isLicense) p = p.parent;
                state.targetLookAt.copy(p.position);
                state.targetZoom = 15;
                console.log('Focused on license:', p.userData.id);
            }
        };

        state.onMouseMove = (e) => {
            const rect = container.getBoundingClientRect();
            state.mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
            state.mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

            // Hover Raycasting
            state.raycaster.setFromCamera(state.mouse, state.camera);
            const intersects = state.raycaster.intersectObjects(state.scene.children, true);
            
            const hit = intersects.find(h => {
                let p = h.object;
                while(p && !p.userData.isLicense && !p.userData.isUser) p = p.parent;
                return p;
            });

            const hud = document.getElementById('three-hud');
            
            // Handle Highlight/Glow
            if (hit) {
                let p = hit.object;
                while(p && !p.userData.isLicense && !p.userData.isUser) p = p.parent;
                
                // If it's a new hover
                if (state.hoveredObject !== p) {
                    // Reset previous
                    if (state.hoveredObject) {
                        state.hoveredObject.traverse(child => {
                            if (child.isMesh && child.userData.oldEmissive !== undefined) {
                                child.material.emissive.setHex(child.userData.oldEmissive);
                            }
                        });
                    }
                    
                    state.hoveredObject = p;
                    
                    // Highlight new
                    state.hoveredObject.traverse(child => {
                        if (child.isMesh) {
                            if (child.userData.oldEmissive === undefined) {
                                child.userData.oldEmissive = child.material.emissive.getHex();
                            }
                            child.material.emissive.setHex(0xff0000); // Terminator Red
                        }
                    });
                }

                if (hud) {
                    hud.style.opacity = '1';
                    document.getElementById('hud-id').textContent = p.userData.id || 'N/A';
                    document.getElementById('hud-type').textContent = p.userData.isLicense ? 'LICENSE_CORE' : 'USER_UNIT';
                    document.getElementById('hud-sca').textContent = p.userData.scaStrategy || 'DEFAULT';
                    document.getElementById('hud-dist').textContent = hit.distance.toFixed(2) + 'm';
                }
            } else {
                if (state.hoveredObject) {
                    state.hoveredObject.traverse(child => {
                        if (child.isMesh && child.userData.oldEmissive !== undefined) {
                            child.material.emissive.setHex(child.userData.oldEmissive);
                        }
                    });
                    state.hoveredObject = null;
                }
                if (hud) hud.style.opacity = '0';
            }

            if (!state.isDragging) return;
            const dx = e.clientX - state.lastMousePos.x;
            const dy = e.clientY - state.lastMousePos.y;
            
            state.targetRotation.theta -= dx * 0.01;
            state.targetRotation.phi = Math.max(0.1, Math.min(Math.PI - 0.1, state.targetRotation.phi + dy * 0.01));
            
            state.lastMousePos = { x: e.clientX, y: e.clientY };
        };

        state.onMouseUp = () => { state.isDragging = false; };
        state.onWheel = (e) => {
            state.targetZoom = Math.max(5, Math.min(100, state.targetZoom + e.deltaY * 0.05));
        };
        state.onKeyDown = (e) => {
            if (e.key === 'Escape') {
                globalThis.dispatchEvent(new CustomEvent('exit-3d-fullscreen'));
            }
        };

        container.addEventListener('mousedown', state.onMouseDown);
        globalThis.addEventListener('mousemove', state.onMouseMove);
        globalThis.addEventListener('mouseup', state.onMouseUp);
        globalThis.addEventListener('keydown', state.onKeyDown);
        container.addEventListener('wheel', state.onWheel);

        this.rebuild(parsedLicenses);

        const animate = () => {
            state.animationId = requestAnimationFrame(animate);
            
            state.currentZoom += (state.targetZoom - state.currentZoom) * 0.1;
            state.lookAt.lerp(state.targetLookAt, 0.1);

            const x = state.lookAt.x + state.currentZoom * Math.sin(state.targetRotation.phi) * Math.cos(state.targetRotation.theta);
            const y = state.lookAt.y + state.currentZoom * Math.cos(state.targetRotation.phi);
            const z = state.lookAt.z + state.currentZoom * Math.sin(state.targetRotation.phi) * Math.sin(state.targetRotation.theta);
            
            state.camera.position.set(x, y, z);
            state.camera.lookAt(state.lookAt);

            state.scene.children.forEach(group => {
                if (group.userData && group.userData.isLicense) {
                    group.rotation.y += 0.005;
                    group.children.forEach(child => {
                        if (child.userData && child.userData.isUser) {
                            const time = Date.now() * 0.001;
                            child.position.y += Math.sin(time + child.userData.offset) * 0.01;
                        }
                    });
                }
            });
            state.renderer.render(state.scene, state.camera);
        };
        animate();

        state.onResize = () => {
            if (!state.renderer) return;
            state.camera.aspect = container.clientWidth / container.clientHeight;
            state.camera.updateProjectionMatrix();
            state.renderer.setSize(container.clientWidth, container.clientHeight);
        };
        globalThis.addEventListener('resize', state.onResize);
    },

    rebuild(parsedLicenses) {
        console.log('3D Rebuild triggered');
        const state = this.state || globalThis.__threeExperimentState;
        if (!state || !state.scene) return;
        
        while(state.scene.children.length > 2) {
            state.scene.remove(state.scene.children[2]);
        }
        const licenses = (parsedLicenses || {}).LICENSES || [];
        console.log(`Rebuilding universe with ${licenses.length} licenses`);
        
        const radius = 15;
        licenses.forEach((lic, i) => {
            const phi = Math.acos(-1 + (2 * i) / (licenses.length || 1));
            const theta = Math.sqrt((licenses.length || 1) * Math.PI) * phi;
            const licenseGroup = new THREE.Group();
            licenseGroup.userData = { isLicense: true, id: lic.id };
            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(phi);
            licenseGroup.position.set(x, y, z);
            const coreGeo = new THREE.IcosahedronGeometry(1.5, 0);
            const coreMat = new THREE.MeshPhongMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.8, wireframe: true });
            licenseGroup.add(new THREE.Mesh(coreGeo, coreMat));
            const users = lic.USERS || [];
            users.forEach((user, ui) => {
                const uAngle = (ui / (users.length || 1)) * Math.PI * 2;
                const uDist = 3 + Math.random() * 2;
                let color = 0x60a5fa;
                if (user.scaStrategy === 'locked') color = 0xef4444;
                if (user.scaStrategy === 'open') color = 0x10b981;
                if (user.scaStrategy === 'bootstrap') color = 0xf59e0b;
                const userMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshPhongMaterial({ color }));
                userMesh.position.set(Math.cos(uAngle) * uDist, (Math.random() - 0.5) * 2, Math.sin(uAngle) * uDist);
                userMesh.userData = { 
                    isUser: true, 
                    id: user.id, 
                    scaStrategy: user.scaStrategy || 'open',
                    offset: Math.random() * Math.PI 
                };
                licenseGroup.add(userMesh);
            });
            state.scene.add(licenseGroup);
        });
    },

    cleanup() {
        const state = this.state || globalThis.__threeExperimentState;
        if (!state) return;

        if (state.animationId) {
            cancelAnimationFrame(state.animationId);
            state.animationId = null;
        }
        
        const container = document.getElementById('three-container');
        if (container) {
            container.removeEventListener('mousedown', state.onMouseDown);
            container.removeEventListener('wheel', state.onWheel);
        }
        globalThis.removeEventListener('mousemove', state.onMouseMove);
        globalThis.removeEventListener('mouseup', state.onMouseUp);
        globalThis.removeEventListener('resize', state.onResize);
        if (state.onKeyDown) {
            globalThis.removeEventListener('keydown', state.onKeyDown);
        }

        if (state.renderer) {
            state.renderer.dispose();
            if (state.renderer.domElement && state.renderer.domElement.parentNode) {
                state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
            }
            state.renderer = null;
        }
    }
};
