<script lang="ts">


  interface FileEvent {
    target: {
      files: FileList;
    };
  }

  let files: {
    accepted: File[];
    rejected: File[];
  } = {
    accepted: [],
    rejected: [],
  };

  function handleFilesSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files) return;
    const files = input.files;
    const acceptedFiles = Array.from(files).filter((file) => file.type.includes('image/'));
    const fileRejections = Array.from(files).filter((file) => !file.type.includes('image/'));

    if (acceptedFiles.length > 0) {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        if (fileReader.result) {
          // addNewImage(fileReader.result as string);
        }
      };
      fileReader.readAsDataURL(acceptedFiles[0]);
    }
  }
</script>

<input
  type="file"
  on:change={handleFilesSelect}
  accept="image/gif,image/png,image/jpeg,image/jpg"
  multiple={false}
/>

<style>


  :global(label[for='file-upload']) {
    border: 2px dashed #cccccc;
    border-radius: 4px;
    padding: 0px;
    text-align: center;
    background-color: #f8f8f8;
    transition: all 0.1s ease;
    max-width: 500px;
    cursor: pointer;
  }

  :global(label[for='file-upload']:hover) {
    border-color: #4caf50;
    background-color: #f0f0f0;
    transition: all 0.1s ease;
  }

  :global(label[for='file-upload'].active) {
    border-color: #4caf50;
    background-color: #e8f5e9;
  }

  :global(label[for='file-upload'] p) {
    margin: 0;
    font-size: 16px;
    color: #333333;
  }
</style>
