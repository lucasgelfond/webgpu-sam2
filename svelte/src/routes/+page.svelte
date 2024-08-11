<script>
  import { onMount } from 'svelte';
  import Encoder from '../encoder.svelte';
  import { currentStatus } from '$lib/current-status';
  onMount(() => {
    const font = new FontFace('UniversLTStd', 'url(/fonts/UniversLTStd.woff)');
    font.load().then(() => {
      document.fonts.add(font);
    });
  });
</script>

<div class="container">
  <h1>Segment Anything 2, in WebGPU</h1>
  <p>{$currentStatus}</p>
  <!-- TK - send blog post before shipping!-->
  <p>
    Built by <a href="http://lucasgelfond.online">Lucas Gelfond</a>. You can read my writeup
    <a href="https://lucasgelfond.online/portfolio/webgpu-sam2">here</a>
    or see the source code <a href="https://github.com/lucasgelfond/webgpu-sam2">here</a>.
  </p>
  <Encoder />
</div>

<style>
  @font-face {
    font-family: 'UniversLTStd';
    src: url('/fonts/UniversLTStd.woff') format('woff');
    font-weight: normal;
    font-style: normal;
  }

  .container {
    display: flex;
    flex-direction: column;
    padding: 100px;
    font-family: 'UniversLTStd', sans-serif;
  }

  h1,
  p {
    margin: 0;
  }

  p {
    margin-top: 20px;
  }
</style>
