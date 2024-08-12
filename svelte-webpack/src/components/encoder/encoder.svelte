<script lang="ts">
  import { onMount } from 'svelte';
  // @ts-ignore
  import processImage from './utils/process-image/process-image';
  import { currentStatus } from '../../lib/current-status';


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
        imageElement.onload = async () => await processImage(imageElement);
        imageElement.src = fileReader.result as string;
      }
    };
    fileReader.readAsDataURL(file);
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
<img bind:this={imageElement} alt="Uploaded" style="display: none;" />

<style>
  .dropzone {
    width: 100%;
    height: 200px;
    border: 2px dashed #ccc;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: #ccc;
    font-size: 1em;
    transition: border-color 0.3s ease-in-out;
    cursor: pointer;
    margin-top: 20px;
    max-width: 700px;
    font-family: 'UniversLTStd', sans-serif;

  }

  .dropzone:hover {
    border-color: #888;
  }
</style>
