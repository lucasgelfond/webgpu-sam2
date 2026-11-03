<script>
  import Viewer from './components/viewer';
  import { currentStatus } from 'src/lib';
</script>

<main>
  <header>
    <h1>Segment Anything 2, in WebGPU</h1>
    <p>
      Model by <a href="https://github.com/facebookresearch/segment-anything-2">Facebook Research</a>.
      Runs entirely in your browser — nothing is uploaded. Needs WebGPU (Chrome 113+; see the
      <a href="https://github.com/gpuweb/gpuweb/wiki/Implementation-Status">implementation status</a>
      for Firefox and Safari).
    </p>
    <p>
      Read the <a href="https://lucasgelfond.online/portfolio/webgpu-sam2">writeup</a> or the
      <a href="https://github.com/lucasgelfond/webgpu-sam2">source</a>. Built by
      <a href="http://lucasgelfond.online">Lucas Gelfond</a> in San Francisco.
    </p>
  </header>

  <section>
    <p class="status" aria-live="polite">{$currentStatus}</p>
    <Viewer />
  </section>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 32px;
    max-width: 720px;
    padding: 80px 24px;
    margin: 0 auto;
    font-family: 'Univers Lt Std', system-ui, sans-serif;
  }
  header {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 600;
  }
  header p {
    margin: 0;
    max-width: 60ch;
    line-height: 1.5;
    color: var(--muted);
  }
  a {
    color: var(--accent);
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .status {
    margin: 0;
    min-height: 1.5em;
    font-size: 1.125rem;
    font-weight: 500;
    line-height: 1.5;
  }

  @media (max-width: 576px) {
    main {
      padding: 40px 16px;
    }
  }
</style>
