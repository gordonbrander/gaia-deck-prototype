A simple proof-of-concept prototype for background parallax.

Using the prototype
-------------------

Open <http://gordonbrander.github.com/gaia-deck-prototype/> on a FirefoxOS
phone.

* Swipe or touch from the right edge of the screen to advance one panel.
* Swipe or touch from the left edge of the screen to go back one panel.

Background
----------

Goal: we want to "fit" background images so we never "run out" of background.

    syncParallax(distance, totalWidth, backgroundWidth, viewportWidth)

Given `distance`, `syncParallax()` will return a corresponding "parallaxed"
distance. The ratio between `distance` and `parallaxed distance` is such that
the left edge of the background will line up with the left edge of the left-most
panel, and the right edge of the background will line up with the right edge
of the right-most panel.

Ratios returned will never exceeed `1:1`. This means for exceedingly long
background images or few panels you will get `1:1` scrolling, but the background
will never move faster than the foreground. In these cases, some of the right
edge of the background not be shown.

I have found that backgrounds between 800px and 1000px deliver pleasant parallax
speeds for 6-9 panels.
