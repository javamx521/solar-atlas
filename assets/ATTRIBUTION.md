# Planet texture credits

Planet and Moon imagery by **Solar System Scope / INOVE**.

- Source: https://sunaeon.solarsystemscope.com/textures/
- Original project: https://www.solarsystemscope.com/
- License: **Creative Commons Attribution 4.0 International (CC BY 4.0)**
- License text: https://creativecommons.org/licenses/by/4.0/legalcode
- Downloaded: 6 October 2026

These textures are based on NASA imagery and elevation data and were assembled,
color-adjusted, and, where coverage was incomplete, artistically completed by
Solar System Scope. They are illustrative maps, not current satellite imagery.
Earth clouds and night lights are static illustrations, not live conditions.
No endorsement by Solar System Scope, INOVE, or NASA is implied.

## Bundled files and modifications

Source files are from https://sunaeon.solarsystemscope.com/textures/download/.
All JPEGs were recompressed at quality 87 with metadata removed. Earth day map
and Jupiter retain their original 2048 × 1024 dimensions; the others were
resized from 2048 × 1024 to 1024 × 512 using Lanczos resampling. No other
image edits were made.

| Bundled file | Original source file |
| --- | --- |
| sun.jpg | 2k_sun.jpg |
| mercury.jpg | 2k_mercury.jpg |
| venus.jpg | 2k_venus_atmosphere.jpg |
| earth.jpg | 2k_earth_daymap.jpg |
| mars.jpg | 2k_mars.jpg |
| jupiter.jpg | 2k_jupiter.jpg |
| saturn.jpg | 2k_saturn.jpg |
| uranus.jpg | 2k_uranus.jpg |
| neptune.jpg | 2k_neptune.jpg |
| moon.jpg | 2k_moon.jpg |
| earth-clouds.jpg | 2k_earth_clouds.jpg |
| earth-night.jpg | 2k_earth_nightmap.jpg |

The fallback textures, stylized Pluto surface, ring texture, stellar field,
and asteroid belt are generated deterministically by this project's code.
They are not externally licensed astronomical images.

## Rendering limitations

Planet sizes and distances are deliberately compressed for legibility. Orbit
positions use a simple circular mean-longitude model; they are not ephemerides
for observation or navigation. Spins and moon periods are slowed and simplified.
The renderer's constant-distance solar lighting preserves readable outer planets
at this artistic scale. Axial tilts are illustrative orientations, not full
J2000 pole models.
