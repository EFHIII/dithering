# Advanced Dithering
This repo serves as a collection of the most interesting dithering algorithms I've come across as well as a few advanced algorithms that I've developed myself.

To use, go here: https://efhiii.github.io/dithering

All of the dithering algorithms are available as standalone files in [src/dithering-algorithms](src/dithering-algorithms)

The scoring metric shown on the webpage is based off of comparing a blurred version of the original image with a blurred version of the dithered image.
However, the goal isn't for the dithered image to look like the original image only when you're squinting at them, which is what we'd get if we just used a gaussian blur.
Instead, this program uses a perception kernel which you can tune yourself, but by default is the sum of 2 gaussians of different sizes plus the center pixel is heavily biased over the other pixels so as to encourage retaining high frequency information where possible.
The size of the kernel defaults to 9x9 pixels. Making the kernel smaller makes the algorithms faster, making it larger allows them to do more spread out dithering though the falloff function may need to be retuned based what would look best given things like the expected fov / pixel.

# Example
starting with this image:

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/700cc0ee-ea7c-4d21-bfd1-89eb9a5b06ab" />

and this Palette:

<img width="128" height="96" alt="image" src="https://github.com/user-attachments/assets/7c7680d0-5a41-498c-abb9-17ad1b9a3d0e" />

If we set each pixel to the "closest" palette color for each pixel (using the [HCT](https://github.com/material-foundation/material-color-utilities/blob/main/typescript/hct/hct.ts) delta function):

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/e7754756-2592-41f5-8dfb-8a0877f0f019" />

For pattern dithering, what we do is devise a pattern for each pixel that, on its own, would match the color of that specific pixel. For example, with this color:

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/baff4994-49a9-4b9b-9540-a71a6400d9b6" />

The Saffron Smooth algorithm gives this pattern (for pattern size = 16):

<img width="64" height="64" alt="image" src="https://github.com/user-attachments/assets/faa8d19e-0b0e-4ec0-985c-8bd965c14753" />

Saffron Accurate, Pattern Dithering, Joel Yliluoma 1, and Greedy Annealing all also give that pattern. Joel Yliluoma 2 only gives 2 of the brighter blue and Joel Yliluoma 3 makes it all the darker blue.

That pattern tiled looks like:

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/f0ea4f01-86b8-41b9-a4db-78725669fe74" />

If we then use a Bayer matrix (4x4 in this case) for deciding which index of the pattern (with the pattern entries sorted by luminance) to render at each pixel, that's the pattern dither algorithm and it gives:

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/8d5d6889-e58b-4780-b2c0-204aec79f523" />

If we instead use a [Void & Cluster matrix](https://efhiii.github.io/Color-Weirdness/#chapter-6) instead of a Bayer matrix, we'll get a less structured looking result. This is the default in the program:

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/a0b846dd-76dc-4c07-b7f0-ae89f250efe5" />

That's not the best that we can do, though. The pattern doesn't take into account the context in the image very well. Error diffusion starts to fix that. Here's what the most popular error diffusion algorithm, Floyd-Steinberg, gives:

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/9f2878d3-60d6-4943-b51a-30f268f0009b" />

You might notice that there are still some undesirable patterns that form. Traditional error diffusion often has that problem. So what if we could just devise a function that rates how good a dithered image is and then tried to optimize that function? Let's try that. But how do you accurately rate a dithered image without relying on subjective opinion?

Well, a good dithered image will look identical to the original when you squint. That is to say, what the dithered image looks like when squinting should look like what the original image looks like when squinting.

It's not hard to imitate the effect of squinting by using a gausian blur (color interpolation in Linear RGB). That doesn't get us all the way there though. What about when we're not squinting? The human brain still psychovisually spreads color out so that when looking at a pattern of different colors next to eachother, our brain interprets it as having the quality of if those colors were mixed together. What I've found works best is using a gaussian blur or two and then adding a strong bias to the center pixel. 

Using a kernel of size 9x9 this is the graph I default to:

<img width="250" height="250" alt="image" src="https://github.com/user-attachments/assets/72b27506-9544-471c-80c5-efd5066b0dff" />

each cell's weight is defined as the definite integral of the graph over that cell in 2D (presumably in Euclidean space, though I have a setting where you can choose Manhatten or Chebyshev Distance for the kernel).

This is what we get by starting with the result of pattern dithering and then iteratively choosing nearby pairs of points, checking how much the dithering score would change, and if the delta + some energy is < 0 (improves the score) apply the change:

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/1fc16580-5f0d-46a2-b4dd-a21a688103d4" />

This is the best algorithm I'm aware of in terms of the quality of dither (assuming a max compute time of about an hour for a moderately sized image like 500x500 with a palette of between around 6 - 256 colors). At the extreme, given enough compute time, the same algorithm but checking 3 or 4 pixel changes at a time may give better results and I do provide `Pixels Per Check` as a parameter for energy dither in Advanced dithering along with the energy settings (starting energy and energy decay). There's also a parameter, `Pattern Bias`, for how often to choose random colors from the pattern devised by the Pattern Dither algorithm vs a purely random palette color. The default is 0.5 but in practice the best value is probably either `0` (never from pattern) or around `0.7` (usually from pattern) depending on if the pattern dither does a good job or not and the size of the palette.

If you don't mind waiting a bit, but don't want to wait that long, we can do a little better. If instead of picking points randomly, we start out by assigning the original image color to each pixel and then iteratively choose to change the pixel that would improve the score the most, and if all changes would worsen the score, the unmodified pixel that worsens it the least, terminating once there are no valid moves left, we get something that's inherently deterministic and gives:

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/40177425-d40e-4961-a84b-4476472f0361" />

Unfortunately, it is a bit slow so in the time it takes to run, Energy Dithering with good settings can often get a better score in the same amount of time. It's a starting point though and it doesn't need too big of a change to outpace Energy Dithering (at least until it finishes, at which point Energy Dither will creep up on its score and overtake it). If instead of choosing the single best pixel to change, we just change pixels in scan-line order until we've done a full pass over every pixel without making a change, then we get this:

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/d61b9547-a761-4333-9de0-c0ae6f686169" />

And that (Least Error Scan) finishes way faster than the previous algorithm (Least Error First). It also gives a slightly worse result than Least Error First, but that's not infrequently the cost of performance. Hypothetically, the best algorithm would be to check the score of all premutations of each palette color in each pixel, but for this 12 color palette and 100x100 image, that would naievely require checking over 100 Googol (12^10000) images, hence why an implementation of that algorithm is not included here. After that, you just need to refine the scoring function which would mean figuring out how to choose the right kernel size and perception falloff graph. The default one I provide is quite good, but I make no claim that it's anywhere near perfect.
