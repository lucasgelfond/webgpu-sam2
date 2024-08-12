<script lang="ts">
  import { onMount } from 'svelte';
  // @ts-ignore
  import { processImage } from './utils';
  import { currentStatus, modelSize } from 'src/lib';

  let imageElement: HTMLImageElement;
  let droppedFile = null;

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      droppedFile = files[0];
      handleFile(droppedFile);
    }
  }

  function handleClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        droppedFile = files[0];
        handleFile(droppedFile);
      }
    };
    input.click();
  }

  function handleFile(file: File) {
    currentStatus.set(`${file.name} was uploaded.`);
    const fileReader = new FileReader();
    fileReader.onload = () => {
      if (imageElement) {
        imageElement.onload = async () => await processImage(imageElement, $modelSize);
        imageElement.src = fileReader.result as string;
      }
    };
    fileReader.readAsDataURL(file);
  }

  async function handleDemoImage() {
    const response = await fetch('https://news.cgtn.com/news/78637a4e3251444d7759444f3567444d31557a4e31457a6333566d54/img/efd368233637445391bc04444d92249e/efd368233637445391bc04444d92249e.jpg');
    const blob = await response.blob();
    const file = new File([blob], 'demo-image.jpg', { type: 'image/jpeg' });
    droppedFile = file;
    handleFile(file);
  }

  onMount(() => {
    const font = new FontFace('UniversLTStd', 'url(/public/fonts/UniversLTStd.woff)');
    font.load().then(() => {
      document.fonts.add(font);
    });
    if (imageElement) {
      imageElement.style.display = 'none';
    }
  });
</script>

<div class="container">
  {#if !droppedFile}
    <div class="demo-image">
      <span on:click={handleDemoImage} on:keydown={(e) => e.key === 'Enter' && handleDemoImage()} role="button" tabindex="0">or click here to start with a demo image</span>
    </div>
  {/if}
  <div class="model-selection">
    <label for="modelSize">Model Size:</label>
    <select id="modelSize" bind:value={$modelSize} disabled={!!droppedFile}>
      <option value="tiny">Tiny</option>
      <option value="small">Small</option>
      <option value="base_plus">Base Plus (recommended)</option>
    </select>
  </div>

  {#if !droppedFile}
    <div
      class="dropzone"
      on:dragover={handleDragOver}
      on:drop={handleDrop}
      on:click={handleClick}
      on:keydown={(e) => e.key === 'Enter' && handleClick()}
      role="button"
      tabindex="0"
      aria-label="File upload area. Drag & drop an image here, or press Enter to select one."
    >
      <span>Drag & drop an image here, or click to select one.</span>
    </div>
  {/if}
</div>

<img bind:this={imageElement} alt="Uploaded" style="display: none;" />

<style>
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 700px;
    width: 100%;
  }

  .dropzone {
    width: 100%;
    height: 200px;
    border: 2px dashed #ccc;
    border-radius: 10px;
    display: flex;
    align-items: center;
    padding: 20px;
    justify-content: center;
    text-align: center;
    color: #ccc;
    font-size: 1em;
    transition: border-color 0.3s ease-in-out;
    cursor: pointer;
    margin-top: 20px;
    font-family: 'UniversLTStd', sans-serif;
  }

  .dropzone:hover {
    border-color: #888;
  }

  .model-selection {
    display: flex;
    flex-direction: row;
    gap: 8px;
    margin-top: 20px;
    width: 100%;
    font-family: 'UniversLTStd', sans-serif;
    align-items: center;
    height: 40px;
  }
  .model-selection label {
    font-weight: 500;
  }
  .model-selection select {
    border-radius: 5px;
    padding: 5px;
  }
  .demo-image {
    width: 100%;
    text-align: left;
    margin-bottom: 10px;
    cursor: pointer;
    color: #0066cc;
    text-decoration: underline;
  }
  .demo-image:hover {
    color: #004080;
  }
</style>
