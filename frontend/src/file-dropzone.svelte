<script lang="ts">
    import Dropzone from "svelte-file-dropzone";
    import { sourceImage } from "$lib/source-image";

    // @ts-ignore
    function addNewImage(newImage) {
        $sourceImage = newImage;
    }
    

    interface FileDropEvent {
        detail: {
            acceptedFiles: File[];
            fileRejections: File[];
        };
    }


    let files: {
        accepted: File[];
        rejected: File[];
    } = {
        accepted: [],
        rejected: []
    };

    function handleFilesSelect(e: FileDropEvent) {
        const { acceptedFiles, fileRejections } = e.detail;
 
        files.accepted = [...files.accepted, ...acceptedFiles];
        files.rejected = [...files.rejected, ...fileRejections];
        if (acceptedFiles.length > 0) {
            const fileReader = new FileReader();
            fileReader.onload = () => {
                if (fileReader.result) {
                    addNewImage(fileReader.result as string);
                }
            };
            fileReader.readAsDataURL(acceptedFiles[0]);
        }
    }
</script>

<Dropzone on:drop={handleFilesSelect} accept="image/gif,image/png,image/jpeg,image/jpg" multiple={false} >
    <p>Upload a photo for segmentation (accepted file types: gif, png, jpg, jpeg)</p>
</Dropzone>


<style>
    :global(.dropzone) {
        border: 2px dashed #cccccc;
        border-radius: 4px;
        padding: 0px;
        text-align: center;
        background-color: #f8f8f8;
        transition: all 0.1s ease;
        max-width: 500px;
    }

    :global(.dropzone:hover) {
        border-color: #4CAF50;
        background-color: #f0f0f0;
        transition: all 0.1s ease;

    }

    :global(.dropzone.active) {
        border-color: #4CAF50;
        background-color: #E8F5E9;
    }

    :global(.dropzone p) {
        margin: 0;
        font-size: 16px;
        color: #333333;
    }
</style>