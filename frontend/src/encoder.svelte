<script>
    import FileDropzone from "./file-dropzone.svelte";
    import { sourceImage } from "$lib/source-image";
    import { onMount } from 'svelte';



</script>

<div class="container">
    {#if $sourceImage === null}
        <FileDropzone />
    {:else}
        <img src={$sourceImage} alt="Uploaded image" style="width: 1024px; height: 1024px;" />
    {/if}
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        padding: 20px;
        font-family: 'UniversLTStd', sans-serif;
    }

    h1, p {
        margin: 0;
    }

    p {
        margin-top: 20px;
    }
</style>