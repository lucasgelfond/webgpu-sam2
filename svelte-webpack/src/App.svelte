<script>
  import Encoder from './components/encoder';
  import Decoder from './components/decoder';
  import { currentStatus } from 'src/lib';

</script>

<div class="container">
  <h1 style="font-weight: 600;">Segment Anything 2, in WebGPU</h1>
  <!-- TK - send blog post before shipping!-->
  <p>
    Model by <a href="https://github.com/facebookresearch/segment-anything-2">Facebook Research</a>. Works in Chrome version &gt;=113, with <code>chrome://flags/#enable-unsafe-webgpu</code> enabled. For use in Firefox and Safari, check the official <a href="https://github.com/gpuweb/gpuweb/wiki/Implementation-Status">WebGPU implementation status</a>.

    <br />
    <br />
    You can read a writeup
    <a href="https://lucasgelfond.online/portfolio/webgpu-sam2">here</a>
    or see the source <a href="https://github.com/lucasgelfond/webgpu-sam2">here</a>.
    Built by <a href="http://lucasgelfond.online">Lucas Gelfond</a> in San Francisco.
  </p>
  <div class="ui-element-container">
    <p class="current-status">
      {$currentStatus}

    </p>

    <Encoder />
    <Decoder />
  </div>
</div>

<style>


  .current-status {
    font-size: 1.5em;
    font-weight: 500;
    font-family: 'Univers Lt Std', sans-serif;
    min-height: 2em;
    line-height: 1.5em;

    }  
  .container {
    padding: 100px;
    display: flex;
    flex-direction: column;
    max-width: 800px;
    gap: 10px;
    font-family: 'UniversLTStd', sans-serif;
  }

  @media (max-width: 1200px) {
    .container {
      max-width: 700px;
    }
  }

  @media (max-width: 992px) {
    .container {
      max-width: 600px;
      padding: 80px;
    }
  }

  @media (max-width: 768px) {
    .container {
      max-width: 500px;
      padding: 60px;
    }
  }

  @media (max-width: 576px) {
    .container {
      max-width: 450px;
      padding: 40px;
    }
  }

  @media (max-width: 480px) {
    .container {
      padding: 20px;
    }
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
