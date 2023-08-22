<template>
    <input v-if="!isJokeJoked" v-model="userInput" @keyup.enter="sendChat" maxlength="100" size="50" placeholder="Your line goes here...">
    <button v-if="isJokeJoked" @click="resetChat" class="reset-btn">New joke</button>
</template>

<script setup>
import { reactive, ref, onMounted, watchEffect} from "vue";
import { useHead } from '@vueuse/head';
import axios from 'axios';
import * as THREE from 'three';
import fish1 from '@/assets/sprites/fish1.png';
import fish2 from '@/assets/sprites/fish2.png';
import bg1 from '@/assets/bg1.jpg';
import bg2 from '@/assets/bg2.jpg';
import bg3 from '@/assets/bg3.jpg';

const title = ref("Fillow and Pish — the Sarcastic Fish");
const selectedBgURL = ref("");
const backgroundTexture = ref(null);
const userInput = ref("");
const gptResponse = ref("");
const isJokeJoked = ref(false);
const sceneSettings = reactive({
  bgColor: "#071932" // dark blue
});

useHead({
  title: title.value,
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ]
});

const openaiApi = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.VUE_APP_OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// const unsplashApi = axios.create({
//   baseURL: 'https://api.unsplash.com',
//   headers: {
//     'Authorization': `Client-ID ${process.env.VUE_APP_UNSPLASH_API_KEY}`,
//     'Content-Type': 'application/json'
//   }
// });

const { Scene, PerspectiveCamera, WebGLRenderer, TextureLoader, } = THREE;

// const fetchRandomSeaBackground = async () => {
//   try {
//     const response = await unsplashApi.get('/photos/random', {
//       params: {
//         query: 'underwater abstract',
//         orientation: 'landscape'
//       }
//     });

//     if (response && response.data && response.data.urls && response.data.urls.raw) {
//       return response.data.urls.raw + '&q=50&w=1080';
//     }
//   } catch (error) {
//     console.error("Error fetching random sea background:", error);
//   }

//   const getRandomBackground = () => {
//       const bgs = [bg1, bg2, bg3];
//       return bgs[Math.floor(Math.random() * bgs.length)];
//   }
//   // If the API request fails, this line will return the local image
//   return getRandomBackground();
// };

function useThreeJsChatScene(settings) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10);
  camera.position.z = 2;

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(settings.bgColor);

  const loader = new TextureLoader();
  const clock = new THREE.Clock();
  
  // Load your fish textures/sprites
  const userFishTexture = loader.load(fish1);
  const gptFishTexture = loader.load(fish2);
  userFishTexture.minFilter = THREE.LinearFilter;
  userFishTexture.minFilter = THREE.LinearFilter;

  //Underwater background
  const getRandomBackground = () => {
      const bgs = [bg1, bg2, bg3];
      return bgs[Math.floor(Math.random() * bgs.length)];
  }
  selectedBgURL.value = getRandomBackground();
  const bgGeometry = new THREE.PlaneGeometry(10, 5);  // Adjust size accordingly
  backgroundTexture.value = new THREE.TextureLoader().load(selectedBgURL.value);

  const vertexShader = `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
      uniform sampler2D bgTexture;
      varying vec2 vUv;

      void main() {
          vec4 texColor = texture2D(bgTexture, vUv);
          gl_FragColor = texColor;
      }
  `;

  const backgroundMaterial = new THREE.ShaderMaterial({
      uniforms: {
          bgTexture: { value: backgroundTexture.value }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.DoubleSide
  });

  const plane = new THREE.Mesh(bgGeometry, backgroundMaterial);
  plane.position.z = -1;  // Adjust position so it's behind the fish
  scene.add(plane);

  const geometry = new THREE.PlaneGeometry(1, 1);
  const userFishMaterial = new THREE.MeshLambertMaterial({
    map: userFishTexture,
    side: THREE.DoubleSide,
    transparent: true
  });

  const gptFishMaterial = new THREE.MeshLambertMaterial({
    map: gptFishTexture,
    side: THREE.DoubleSide,
    transparent: true
  });

  const userFish = new THREE.Mesh(geometry, userFishMaterial);
  const gptFish = new THREE.Mesh(geometry, gptFishMaterial);

  scene.add(userFish, gptFish);
  userFish.position.set(-1, 0, 0);  // position fish on the left
  gptFish.position.set(1, 0, 0);   // position fish on the right

  const userBubbleMaterial = new THREE.SpriteMaterial({
    map: createTextTexture(''),  // Initially empty
    transparent: true
  });

  const gptBubbleMaterial = new THREE.SpriteMaterial({
    map: createTextTexture(''),  // Initially empty
    transparent: true
  });
  const userBubble = new THREE.Sprite(userBubbleMaterial);
  const gptBubble = new THREE.Sprite(gptBubbleMaterial);
  userBubble.scale.set(2, 2, 1);  // Adjust as needed
  gptBubble.scale.set(2, 2, 1);  // Adjust as needed

  scene.add(userBubble, gptBubble);
  userBubble.visible = false;  // Hide by default
  gptBubble.visible = false;  // Hide by default

  const bubbles = [];
  const bubbleGeometry = new THREE.CircleGeometry(0.05, 32);  // small circle geometry
  const bubbleMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8 });

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.25); // The color and intensity
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffff00, 1); // The color and intensity
  const targetObject = new THREE.Object3D();  // Create an empty object
  scene.add(targetObject);  // Add it to the scene
  directionalLight.position.set(0, 10, 5)
  directionalLight.target = targetObject;
  scene.add(directionalLight);

  const fogNear = 2; // Start of the fog in relation to the camera's position
  const fogFar = 2.25;  // End of the fog where it's fully opaque
  scene.fog = new THREE.Fog(settings.bgColor, fogNear, fogFar);

  // Create a few bubbles
  for (let i = 0; i < 5; i++) {
    const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
    bubble.position.set(
      gptFish.position.x - .1,
      gptFish.position.y + (Math.random() - 0.5), // random y position around gptFish
      gptFish.position.z + (Math.random() - 0.5)  // random z position around gptFish
    );
    bubbles.push(bubble);
    scene.add(bubble);
  }
  bubbles.forEach(bubble => bubble.visible = false);

  function animate() {
    const elapsedTime = clock.getElapsedTime();  // Get the time since the clock started

    // Use sine wave to make fish float up and down over time.
    // The numbers can be adjusted to change the speed and amplitude of the movement.
    userFish.position.y = 0.1 * Math.sin(elapsedTime);
    gptFish.position.y = 0.1 * Math.sin(elapsedTime + Math.PI/4);  // Adding offset so they don't move in sync

    // Make the fish turn a bit.
    userFish.rotation.z = 0.1*Math.sin(elapsedTime);
    gptFish.rotation.z =  0.1*Math.sin(elapsedTime + Math.PI/4);
    userFish.rotation.y = 0.175*(Math.sin(elapsedTime / 2) - 1);
    gptFish.rotation.y =  0.175*(Math.sin(elapsedTime / 2) + 1); 

    bubbles.forEach(bubble => {
      bubble.position.y += 0.01;  // adjust the speed as needed
      if (bubble.position.y > gptFish.position.y + 1) {
        bubble.position.y = gptFish.position.y;  // reset position when it goes too high
      }
    });

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  onMounted(async () => {
    // selectedBgURL.value = await fetchRandomSeaBackground();
    // backgroundTexture.value = new THREE.TextureLoader().load(selectedBgURL.value);
    // backgroundMaterial.uniforms.bgTexture.value = backgroundTexture.value;
    document.querySelector("#app").prepend(renderer.domElement);
    clock.start();  // Start the clock
    animate();
  });
  
  watchEffect(() => {
    // Update any reactive changes here. For instance, if fishes should change color or position.
  });

  async function sendChat() {
    console.log('start')
    isJokeJoked.value = true;
    
    // Show user's speech bubble
    userBubble.material.map = createTextTexture(userInput.value);
    userBubble.scale.set(userBubble.material.map.image.width / 500, userBubble.material.map.image.height / 500, 1);  // You can adjust the denominator for size
    userBubble.position.set(-1, 1, 0);  // Above the user fish
    userBubble.visible = true;
    
    // Show bubbles when waiting for a response
    bubbles.forEach(bubble => bubble.visible = true);
    const response = await promptAgent();

    // Mocking a response from "GPT". Replace with actual OpenAI API call.
    gptResponse.value = `${response.choices[0].message.content}`;

    // Show GPT's speech bubble
    gptBubble.material.map = createTextTexture(gptResponse.value);
    gptBubble.scale.set(gptBubble.material.map.image.width / 500, gptBubble.material.map.image.height / 500, 1);  // You can adjust the denominator for size
    gptBubble.position.set(1, 1, 0);  // Above the GPT fish
    gptBubble.visible = true;
    bubbles.forEach(bubble => bubble.visible = false);
    userInput.value = ""; // Reset the user input
  }

  

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setPixelRatio(window.devicePixelRatio);

  return { sendChat, userBubble, gptBubble };
}

const { sendChat, userBubble: userBubbleSprite, gptBubble: gptBubbleSprite } = useThreeJsChatScene(sceneSettings);

function resetChat() {
    // Clear the chat bubbles
    userBubbleSprite.visible = false;  // Hide the user bubble
    gptBubbleSprite.visible = false;   // Hide the GPT bubble

    // Reset the isChatStarted flag
    isJokeJoked.value = false;
  }

function createTextTexture(message) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  const maxLineWidth = 600;  // Define a max width for each line
  const lineHeight = 54;  // Line height, adjust as needed
  context.font = '48px Arial';

  // Breaks the message into multiple lines
  let lines = [];
  let words = message.split(" ");
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
      let word = words[i];
      let width = context.measureText(currentLine + " " + word).width;
      if (width < maxLineWidth) {
          currentLine += " " + word;
      } else {
          lines.push(currentLine);
          currentLine = word;
      }
  }
  lines.push(currentLine);

  // Set canvas dimensions
  canvas.width = maxLineWidth + 60;  // Some padding
  canvas.height = lines.length * lineHeight + 60;  // Adjusted height based on number of lines

  // Draw a white rounded rectangle for the bubble
  context.fillStyle = '#FFFFFF';
  context.strokeStyle = '#000000'; 
  context.lineWidth = 3;  // Border thickness

  roundRect(context, 0, 0, canvas.width, canvas.height, canvas.height);
  context.fill();
  context.stroke();
  
  // Draw text in black
  context.fillStyle = '#000000';
  context.font = '48px Arial';
  for (let i = 0; i < lines.length; i++) {
      context.fillText(lines[i], 60, (i + 1.4) * lineHeight);  // Adjust position based on line index
  }
  
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;

  return texture;
}

// Helper function to draw rounded rectangles
function roundRect(context, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
}

async function promptAgent () {
  // const opponent = (agent === this.agents.agent1) ? this.agents.agent2.name : this.agents.agent1.name
  const prompt = {
    model: process.env.VUE_APP_MODEL,
    messages: [
      { role: process.env.VUE_APP_MODEL == 'gpt-4' ? 'system' : 'user', content: `Fillow and Pish is a hysterical satirical show, where two ironic and sharp-tongued fish discuss relevant topics in short postironic manner. They are neurotic, sarcastic and ironic. Continue the joke with one ore two short sentences. Fillow: ${userInput.value}` },
      { role: 'user', content: `Pish: ` }
    ],
    max_tokens: 512,
    user: 'Fillow-and-Pish'
  }
  // Call the OpenAI API with the constructed prompt
  console.log('prompt: ', { ...prompt })
  const response = await callOpenAI(prompt)

  // Return the response
  return response.data
}

async function callOpenAI(prompt) {
    const apiUrl = '/chat/completions';
    try {
        const response = await openaiApi.post(apiUrl, prompt);
        console.log('response:', { ...response });
        return response;
    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        return null;
    }
}
</script>

<style>

body, html {
  background: #321;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  padding: 0;
  margin: 0;
}

#app {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  position: relative;
  font-size: 1.2rem;
  font-family: Calibri, sans-serif;
  text-shadow: 0 0 1px #111;
  color: #ffe;
  text-align: center;
  background-color: #071932;
  overflow: hidden;
}

canvas, .copy {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
}

input {
  position: absolute;
  bottom: 2em;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px;
  font-size: 16px;
}

.reset-btn {
  background-color: seagreen;
  color: white;
  border: none;
  border-radius: 20px;
  padding: 10px 20px;
  cursor: pointer;
  font-size: 16px;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  z-index: 100;
  position: absolute;
  bottom: 2em;
}

.reset-btn:hover {
  transform: scale(1.05); /* Button enlarges slightly when hovered */
  box-shadow: 2px 2px 12px rgba(0, 0, 0, 0.3); /* A more pronounced shadow when hovered */
}

.reset-btn:active {
  transform: scale(1); /* Button returns to normal size when clicked */
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.2); /* Return to normal shadow when clicked */
}
</style>
