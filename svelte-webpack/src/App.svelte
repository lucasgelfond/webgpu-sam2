<script>
  import { onMount } from 'svelte';
  import Encoder from './components/encoder';
  import Decoder from './components/decoder';
  import { currentStatus } from './lib/current-status';
  onMount(() => {
    const font = new FontFace('UniversLTStd', 'url(/public/fonts/UniversLTStd.woff)');
    font.load().then(() => {
      document.fonts.add(font);
    });
  });
</script>

<div class="container">
  <h1>Segment Anything 2, in WebGPU</h1>
  <!-- TK - send blog post before shipping!-->
  <p>
    Built by <a href="http://lucasgelfond.online">Lucas Gelfond</a>. You can read my writeup
    <a href="https://lucasgelfond.online/portfolio/webgpu-sam2">here</a>
    or see the source code <a href="https://github.com/lucasgelfond/webgpu-sam2">here</a>.
  </p>
  <div class="ui-element-container">
    <p class="current-status">{$currentStatus}</p>

    <Encoder />
    <Decoder />
  </div>
</div>

<style>
  @font-face {
    font-family: 'UniversLTStd';
    src: url('/fonts/UniversLTStd.woff') format('woff');
    font-weight: normal;
    font-style: normal;
  }

  .current-status {
    font-size: 1.5em;
    font-weight: bold;
  }

  .container {
    padding: 100px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: 'UniversLTStd', sans-serif;
  }

  .ui-element-container {
    max-width: 800px;
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 40px;
    border-radius: 10px;
    background-color: #f5f5f5;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  h1,
  p {
    margin: 0;
  }

  p {
    margin-top: 20px;
  }
</style>
