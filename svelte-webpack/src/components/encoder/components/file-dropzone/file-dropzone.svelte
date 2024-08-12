<script>
  let droppedFile = null;

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      droppedFile = files[0];
    }
  }

  function handleClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (event) => {
      const files = event.target.files;
      if (files.length > 0) {
        droppedFile = files[0];
      }
    };
    input.click();
  }
</script>

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
    font-size: 1.2em;
    transition: border-color 0.3s ease-in-out;
    cursor: pointer;
  }

  .dropzone:hover {
    border-color: #888;
  }

</style>

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
