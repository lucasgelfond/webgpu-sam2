## Optimizing Segment Anything 2 Models for the web

If the models are updated, or you decide to fine-tune them, the process for actually getting them into the browser is fairly straightforward but non-obvious. Here's the method I settled on:

- Clone the original [Facebook Research Segment Anything 2](https://github.com/facebookresearch/segment-anything-2/tree/main)
- Install as instructed (just `pip install -e .`) and use their `download_ckpts.sh` script. (Or, skip the script and copy/paste the URLs into your browser, LOL)
- Install [samexporter](https://github.com/vietanhdev/samexporter), which has support for converting models to ONNX format, which we need for hte ONNX runtime under the hood.
- Use the `samexporter` scripts to split the models into encoder/decoder and save the results. This worked for me up to the large model, where my 2023 Macbook Pro ran out of memory. YMMV! Anyways, there's a handy `convert_all_meta_sam2.sh` script, or you can do it manually.

`python -m samexporter.export_sam2 --checkpoint original_models/sam2_hiera_base_plus.pt \
    --output_encoder output_models/sam2_hiera_base_plus.encoder.onnx \
    --output_decoder output_models/sam2_hiera_base_plus.decoder.onnx \
    --model_type sam2_hiera_base_plus`

- Install the onnxruntime on Python. I already had it installed, but `pip install onnxruntime` should do the trick if you don't already.
- You can then use their [built in utility](https://onnxruntime.ai/docs/performance/model-optimizations/ort-format-models.html) to optimize the models to .ORT format, like so:

`python -m onnxruntime.tools.convert_onnx_models_to_ort sam2_hiera_base_plus.encoder.onnx
`

- This process will split a bunch of files. The only one you want is the .ort file called something like `sam2_hiera_base_plus.encoder.with_runtime_opt.ort`. You can ignore the other files.

## Fetching Models

I initially planned to simply put the models into the build, but both Vercel and GitHub have 100 MB limits, typically okay for the decoders (~20 MB) but all of the encoders I could process topped 100 MB. I was going to use a CDN but it seemed pretty expensive and unecessary. So, my solution was:

- Store the models in the user's browser after first download. I'm using [origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) which can save and access reasonably large files. My understanding, for example, Chrome will store up to 2 GB or 20% of free disk space (whatever is smaller) per website. You can see the exact logic in `fetch-model.ts`, but, basically, given a model we check to see if it is in the cache, and if not, we fetch it.
- Split each of the large models up, using `split-model.js`. This literally takes the model, splits it into separate array buffers, and saves them to disk.
- Upload the split models to GitHub.
- Have logic within `fetch-model.ts` that knows when a model has multiple parts, and that it needs to fetch twice in that case.
