import { writable } from 'svelte/store';

// Create a canvas element
const canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 300;

// Get the 2D rendering context
const ctx = canvas.getContext('2d');

// Set background color
ctx.fillStyle = '#f0f0f0';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Set text properties
ctx.font = '24px Arial';
ctx.fillStyle = '#333333';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

// Draw the text
ctx.fillText('Upload an image', canvas.width / 2, canvas.height / 2);

// Get the ImageData from the canvas
const defaultImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

// Create the writable store with the default ImageData
export const inputImageData = writable<ImageData>(defaultImageData);
