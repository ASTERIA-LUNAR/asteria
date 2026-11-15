# Historical Capsule

<!-- Generated with Claude Code (Anthropic) under human direction. -->

## Purpose

A short (about 73 s), illustrated animation of key milestones in space exploration, in chronological order. It ends at the lunar south pole, the region ASTERIA studies, and leads back into the Explore page. It gives the project some personality. It is **not part of ASTERIA's science**.

## Separation from the science

* It is a separate navigation item ("Historical Capsule"), placed after About behind a thin divider. It is styled differently from the scientific tabs (an amber pill) and is not a `.tab`.
* It opens as a full-screen overlay that never opens automatically. The app stays loaded underneath. Closing the capsule restores the tab, map view, URL hash, scroll position and focus exactly as they were.
* A permanent corner banner reads: "Historical illustrations - artistic, simplified, not to scale; not ASTERIA data".
* `js/capsule.js` is loaded with a script tag on the first click only. It reads nothing from ASTERIA and writes nothing to it: no engine, data, results or 3D code is used or changed. The only exception is the final button, which switches to the Explore tab by clicking it.
* Nothing runs while the capsule is closed: no requestAnimationFrame, no timers and no window listeners. `tests/ui_capsule.js` checks this.

## Milestones (verified)

The captions in the app come from one data array (`CHAPTERS` in `js/capsule.js`, exposed as `AsteriaCapsule.chapters`). `tests/ui_capsule.js` checks that the table below matches it: year, milestone, caption and every source URL. All pages were read on 2026-11-15.

<!-- MILESTONES_START -->
| # | Year | Milestone | Caption (exact, as shown) | Date and nation | Source URL(s) | What the source states |
|---|------|-----------|---------------------------|-----------------|---------------|------------------------|
| 1 | 1957 | Sputnik 1 | The Soviet Union launches the world's first artificial satellite, and the Space Age begins. | Launched 4 Oct 1957; USSR | https://www.nasa.gov/history/sputnik/index.html | "The course of history changed on October 4, 1957, when the Soviet Union successfully launched Sputnik 1." "The world's first artificial satellite was about the size of a beach ball" |
| 2 | 1959 | Luna 2 | A Soviet probe becomes the first spacecraft to reach the Moon, striking its surface. | Launched 12 Sep 1959; impact 13 Sep 1959 (UT; 14 Sep Moscow time); USSR | https://science.nasa.gov/moon/missions/ ; https://science.nasa.gov/deep-space-exploration/ | Moon missions table: "Sept. 12, 1959 / Sept. 13, 1959 ... Successful; first spacecraft to impact the Moon's surface". Deep space firsts: "First spacecraft to impact the Moon: USSR / Second Soviet Space Rocket [Luna 2] / 14 September 1959" |
| 3 | 1961 | Vostok 1 | Yuri Gagarin becomes the first human to orbit the Earth, in a flight of 108 minutes. | 12 Apr 1961; USSR | https://science.nasa.gov/resource/yuri-gagarin-first-human-in-space/ | Page title "Yuri Gagarin: First Human in Space"; "On April 12, 1961, the era of human spaceflight began"; "became the first human to orbit the Earth in his Vostock I spacecraft"; "The flight lasted 108 minutes." |
| 4 | 1966 | Luna 9 | The first soft landing on the Moon, and the first picture from its surface. | Launched 31 Jan 1966; landed 3 Feb 1966; USSR | https://science.nasa.gov/moon/missions/ | "Jan. 31, 1966 / Feb. 3, 1966 ... Successful; first lunar soft landing and first picture from the lunar surface" |
| 5 | 1968 | Apollo 8 | Borman, Lovell and Anders become the first humans to orbit the Moon, and see Earthrise. | Launched 21 Dec 1968; lunar orbit 24 Dec 1968; USA | https://www.nasa.gov/mission/apollo-8/ ; https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1968-118A | "On Christmas Eve, Frank Borman, Jim Lovell, and Bill Anders were the first humans to orbit the Moon and the first to see an Earthrise above its surface." NSSDCA: "launched on December 21, 1968"; "Orbit insertion took place on 24 December" |
| 6 | 1969 | Apollo 11 | Armstrong and Aldrin land and walk on the Moon while Collins pilots the command module in orbit. | Landed 20 Jul 1969, 20:17:40 UT; USA | https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C ; https://www.nasa.gov/mission/apollo-11/ | NSSDCA: "The LM landed at 20:17:40 UT ... on 20 July 1969"; "the first men to walk on the Moon"; "They put up an American flag"; "the CSM, piloted by Michael Collins". nasa.gov: "View of the Apollo 11 Lunar Module in lunar orbit as seen by Michael Collins on the command module." |
| 7 | 1970 | Luna 17 and Lunokhod 1 | Luna 17 lands Lunokhod 1, the first remote-controlled rover on the Moon. | Launched 10 Nov 1970; landed 17 Nov 1970; USSR | https://science.nasa.gov/image-article/apod-1997-april-20-moon-robot-lunokhod-1/ ; https://science.nasa.gov/moon/missions/ | APOD: "On November 17, 1970 the Soviet Luna 17 spacecraft landed the first roving remote-controlled robot on the Moon". Moon missions: "11/10/1970 / 11/17/1970 ... delivered Lunokhod 1 rover to the surface of the Moon". Deep space firsts: "First wheeled vehicle on Moon: USSR / Lunokhod 1 / 17 November 1970" |
| 8 | 1972 | Apollo 17 | Apollo's last lunar landing: Cernan and Schmitt explore Taurus-Littrow with the Lunar Roving Vehicle. | Landed 11 Dec 1972, 19:54:57 UT; USA | https://www.nasa.gov/mission/apollo-17/ ; https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1972-096C | nasa.gov: "The Apollo Program's last lunar landing mission ... landed in the Moon's Taurus-Littrow Valley". NSSDCA: "landed at 19:54:57 UT" (after separating "on 11 December 1972"); "The LRV was used during EVAs"; "the sixth and last lunar lander in the Apollo program" |
| 9 | 2009 | LCROSS and LRO | LCROSS strikes Cabeus crater near the south pole and detects water; LRO's laser altimeter maps the terrain ASTERIA uses. | Launched together 18 Jun 2009; LCROSS impact 9 Oct 2009, 11:31 UT; USA | https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031B ; https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031A | LCROSS: "Centaur impact took place on 9 October 2009 at 11:31:19.5 UT"; "impact in Cabeus ... near the lunar south pole". The page lists the reference "Detection of water in the LCROSS ejecta plume" (Science 330, 2010) and the 13 Nov 2009 Ames release "LCROSS Impact Data Indicates Water on Moon". LRO: "Launch Date: 2009-06-18"; "Lunar Orbiter Laser Altimeter (LOLA)". ASTERIA's terrain is LOLA data (README) |
| 10 | 2019 | Chang'e 4 | China makes the first landing on the Moon's far side, and the Yutu-2 rover drives off. | Landed 3 Jan 2019; China | https://science.nasa.gov/moon/missions/ ; https://www.nasa.gov/solar-system/first-look-change-lunar-landing-site/ | nasa.gov: "On Jan. 3, 2019, the Chinese spacecraft Chang'e 4 safely landed on the floor of the Moon's Von Kármán crater". Moon missions table row "Chang'e 4 and Yutu 2 ... 01/03/2019 ... first lunar farside landing" (see note 1) |
| 11 | 2023 | Chandrayaan-3 | India's Chandrayaan-3 becomes the first spacecraft to soft-land near the lunar south pole, and deploys a rover. | Launched 14 Jul 2023; landed 23 Aug 2023; India | https://science.nasa.gov/mission/chandrayaan-3/ ; https://science.nasa.gov/moon/missions/ ; https://www.isro.gov.in/Chandrayaan3.html | NASA: "landed near the south pole of the Moon on Aug. 23, 2023"; "The mission includes a lander and a rover." Moon missions: "First spacecraft to soft land near the lunar South Pole." (note 1). ISRO: "Chandrayaan-3 has successfully soft-landed on the moon." |
| 12 | 2024 | SLIM, IM-1 and Chang'e 6 | SLIM lands within 100 m of its target, Odysseus lands near the south pole, and Chang'e 6 returns far-side samples. | SLIM 20 Jan 2024, 0:20 JST (Japan); IM-1 Odysseus 22 Feb 2024, 6:24 p.m. EST (USA); Chang'e 6 launched 3 May, landed 1 Jun 2024 (China) | https://global.jaxa.jp/press/2024/01/20240125-1_e.html ; https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/ ; https://science.nasa.gov/moon/missions/ | JAXA: "landed on the lunar surface on January 20, 2024 at 0:20 am JST"; "approximately 55m east of the original target landing site"; "technology demonstration of pinpoint landing within an accuracy of 100m ... has been achieved". NASA: Odysseus "softly landed near crater Malapert A in the South Pole region of the Moon at 6:24 p.m. EST" on Feb. 22. Moon missions: Chang'e 6 "05/03/2024 / 06/01/2024 ... First sample return from the lunar far side." (note 1) |
| 13 | 2026 | Artemis II | Three NASA astronauts and one CSA astronaut fly around the Moon, the first crewed lunar flyby in 50 years. | Launched 1 Apr 2026; splashdown 10 Apr 2026; USA with Canada | https://www.nasa.gov/mission/artemis-ii/ | Title "Artemis II: NASA's First Crewed Lunar Flyby in 50 Years"; "launched the Orion spacecraft carrying NASA astronauts Reid Wiseman, Victor Glover, and Christina Koch, along with CSA (Canadian Space Agency) astronaut Jeremy Hansen, on the Artemis II mission on April 1, 2026"; splashdown "April 10, 2026"; "Meet the astronauts who ventured around the Moon" |
| 14 | 2028 | Next: Artemis IV (planned) | Planned: two astronauts descend to spend about a week near the Moon's south pole; launch targeted for early 2028. | Planned; launch "Early 2028"; USA | https://www.nasa.gov/mission/artemis-iv/ ; https://www.nasa.gov/news-release/nasa-adds-mission-to-artemis-lunar-program-updates-architecture/ | Artemis IV page (last updated 16 Mar 2026): "Crewed Surface Landing"; launch "Early 2028"; "two crew members will descend to the surface and spend approximately a week near the South Pole of the Moon". Release, 27 Feb 2026: "to prepare for an Artemis IV landing in 2028" |
<!-- MILESTONES_END -->

**Note 1 (honest limitation).** The Moon missions table on science.nasa.gov is long. For the rows after 1994 (Chang'e 4, Chandrayaan-3, SLIM, IM-1, Chang'e 6), the page reader returned a summary rather than the verbatim row text. The wording quoted for those rows is from that summary. Each claim also rests on a second, verbatim source where one was found: the NASA Chang'e 4 article (date and landing), the NASA Chandrayaan-3 page (landing near the south pole) and the JAXA and NASA pages for SLIM and Odysseus. The owner may want to check the three "first" claims (far-side landing, soft landing near the south pole, far-side sample return) on the live table.

**Note 2 (Luna 9 wording).** NASA's Moon missions table says Luna 9 made the "first lunar soft landing". NASA's Deep space robotic firsts page instead calls Luna 9 the first "survivable landing" and Surveyor 1 (2 Jun 1966) the "First soft-landing on the Moon". The caption follows the Moon missions table.

### What was cut or changed from the suggested set, and why

* **Luna 3** (far-side photos, Oct 1959) was dropped from the Luna 2 caption: there was no time to verify it, and the caption stays one sentence.
* **Luna 9 / Surveyor 1** was not mentioned in the caption (see note 2).
* **Apollo 15** (first Lunar Roving Vehicle drive) is not its own chapter. The rover is shown and named in the Apollo 17 chapter, and no "first" is claimed. This kept the capsule at 14 chapters (about 73 s).
* **Chandrayaan-1 / NASA M3** (water, 2009) was dropped from the 2009 chapter. The ISRO Chandrayaan-1 page lists M3 but does not state the water detection, and the NASA source for it could not be read. The 2009 chapter is LCROSS and LRO (USA).
* **Chandrayaan-3** is not called "the closest to the south pole". No source stating that was found. The 69.37° S figure is ISRO's prime landing site, not a stated touchdown point, so the caption uses NASA's wording "first spacecraft to soft land near the lunar South Pole".
* **IM-1** is not called "the first commercial lunar landing". The NASA page that could be read describes the landing only as "the first successful soft landing of NASA's CLPS initiative". The caption says it landed near the south pole.
* **Chang'e 6**: the 25 June 2024 return date was not verified, so the caption says only that it returns far-side samples.
* **Artemis II**: "the first crew to the Moon since 1972" became NASA's own words, "first crewed lunar flyby in 50 years".
* **Artemis IV**: described as planned, with launch "targeted for early 2028". The south pole is mentioned because the current NASA Artemis IV page states it.

### Flags

Each flag is drawn in code with the official proportions: USA 10:19 with 13 stripes and 50 stars in 9 rows of 6/5; USSR 1:2 with the gold star outline and the hammer and sickle, simplified at chip size; China 2:3 with five stars, each small star pointing at the large one; India 2:3 with the 24-spoke chakra; Japan 2:3 with a disc 3/5 of the height; Canada 1:2 with the 11-point maple leaf. Flags appear only in the caption chips, plus the US flag planted at Apollo 11.

## What is illustrative

Everything drawn is illustrative: simplified, recognisable silhouettes with approximate proportions, not to scale, in an original flat editorial style. This covers:

* **Rockets**: R-7/Vostok with four strap-on boosters (staging shown), SLS with Orion.
* **Spacecraft**: Sputnik 1, the Luna 2 probe, the Luna 9 lander (petals opening), the Apollo CSM, the Apollo Lunar Module, Lunokhod 1 and the Luna 17 platform, the Lunar Roving Vehicle, LRO, the LCROSS/Centaur impactor, a Chang'e-4-style lander with a Yutu-2-style rover and a Queqiao-style relay, a Chandrayaan-3-style lander and rover, and Orion.
* **The Artemis IV lander** is a generic tall lander, not a specific vehicle.
* **Astronauts** are suited figures with gold visors, with no faces.
* **Places and paths**: Earth, the Moon, craters, hills and trajectories (including Artemis II's figure-of-eight) are schematic.

There are no logos or insignia of any agency, and no images, fonts or videos from outside the project.

## Controls

* Play/pause, previous, next and a chapter strip of years (jump to any milestone).
* Exit with the X button or Esc. Esc closes the Sources panel first if it is open.
* Keyboard: Space plays or pauses; Left and Right change the milestone; Tab and Shift+Tab stay inside the capsule (focus is trapped). On exit, focus returns to the Historical Capsule button.
* "Sources" (i) pauses playback and lists each milestone's sources, a note on what is illustrative, and the credit line: "Illustrations and animation are drawn by code written with Claude Code (Anthropic), an AI coding assistant; historical facts are from the sources listed." This is the only AI wording in the capsule.
* The final card, "Next: humans return to the Moon", has the button "Explore the south-pole landing sites". It closes the capsule and opens Explore.
* Phones: all buttons are at least 40 × 40 px (year buttons 44 px tall), and the strip scrolls sideways.

## Rhythm

Each chapter lasts 5.2 s of wall-clock time:

1. Normal speed (1.0×) while the transition finishes.
2. A smooth slowdown to 0.28× by 1.3 s.
3. The caption enters (1.1-1.55 s) and stays fully readable for 2.55 s while the scene keeps moving slowly.
4. The caption exits (4.1-4.45 s), the scene speeds up to 1.0× and then 1.3×, and a 0.5 s transition starts: a camera pan with a warm light sweep, and a cross-fade into the next scene.

Playback speed is never zero unless the user pauses. On the end card, the last scene keeps drifting at 0.28×. With 14 chapters the total is about 73 s.

## Accessibility

* The overlay is a `role="dialog"` with `aria-modal="true"`. The caption is `aria-live="polite"`, the year buttons carry the milestone name as their label, and the canvas is `aria-hidden`.
* Text contrast: dark text on the amber button is at least 4.5:1 on every gradient stop (tested). Captions are white text on dark space, over a dark scrim.
* With prefers-reduced-motion: speed is 60 % of normal, transitions are plain 0.8 s cross-fades (no pan, no light sweep), stars and flames do not twinkle or flicker, and there is no light sweep on the nav button.

## Performance

* Canvas 2D at up to 2× device pixel ratio. The scene is redrawn only while playing (or once after a jump or resize while paused).
* Nothing runs while the capsule is closed. Playback pauses while the browser tab is hidden.
* Measured numbers are in the test report (`node tests/ui_capsule.js`). See the round summary in ROUND6_REPORT.md / the commit message.
