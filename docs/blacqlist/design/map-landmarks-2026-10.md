# Map landmarks

**For:** the founder and whoever edits the map next.
**Status:** APPROVED by the founder 2026-10-01, all 26 entries as listed. The four flagged calls are kept: Chicago State as a PBI, Charles R. Drew as an HBGI, Victory Monument and Roberts Temple, and districts as single points.
**Last updated:** 2026-10-01
**Code:** `lib/map/landmarks.ts`. Change this doc and that file together.

Your note on the Photo Pins map: it "doesn't feel detailed enough with recognizable landmarks for people." The map now has two kinds of landmark.

1. **From the map data.** Parks, stadiums, campuses, museums, theatres, libraries, city halls, airports, train stations, marinas and beaches, labeled with their usual icons. Restaurants, shops, schools and bus stops stay off, because our listings are the businesses on this map.
2. **Our own list, below.** HBCUs and Black history and culture districts, each marked with a small gold diamond and its name. The diamond shows from zoom 10 and the name from zoom 11. Our landmarks win over the map's own labels, and our listings and photo pins always sit on top of everything.

Every coordinate comes from the linked Wikipedia article and was cross-checked against Wikidata on 2026-10-01. To cut an entry, strike it here and I remove it from the code. To add one, name it and I source it the same way.

## The list

| City | On the map | Kind | Source |
|---|---|---|---|
| Atlanta | Sweet Auburn | District | [Wikipedia](https://en.wikipedia.org/wiki/Sweet_Auburn) |
| Atlanta | MLK Jr. National Historical Park | Memorial | [Wikipedia](https://en.wikipedia.org/wiki/Martin_Luther_King_Jr._National_Historical_Park) |
| Atlanta | Atlanta University Center | HBCU | [Wikipedia](https://en.wikipedia.org/wiki/Atlanta_University_Center) |
| Houston | Emancipation Park | Memorial | [Wikipedia](https://en.wikipedia.org/wiki/Emancipation_Park_(Houston)) |
| Houston | Texas Southern University | HBCU | [Wikipedia](https://en.wikipedia.org/wiki/Texas_Southern_University) |
| Houston | Freedmen's Town | District | [Wikipedia](https://en.wikipedia.org/wiki/Fourth_Ward,_Houston) |
| Houston | Project Row Houses | Museum | [Wikipedia](https://en.wikipedia.org/wiki/Project_Row_Houses) |
| Chicago | Bronzeville | District | [Wikipedia](https://en.wikipedia.org/wiki/Douglas,_Chicago) |
| Chicago | Victory Monument **new suggestion** | Memorial | [Wikipedia](https://en.wikipedia.org/wiki/Victory_Monument_(Chicago)) |
| Chicago | Roberts Temple **new suggestion** | Memorial | [Wikipedia](https://en.wikipedia.org/wiki/Roberts_Temple_Church_of_God_in_Christ) |
| Chicago | DuSable Black History Museum | Museum | [Wikipedia](https://en.wikipedia.org/wiki/DuSable_Black_History_Museum) |
| Chicago | Chicago State University | Predominantly Black institution | [Wikipedia](https://en.wikipedia.org/wiki/Chicago_State_University) |
| Los Angeles | Leimert Park Village | District | [Wikipedia](https://en.wikipedia.org/wiki/Leimert_Park,_Los_Angeles) |
| Los Angeles | California African American Museum | Museum | [Wikipedia](https://en.wikipedia.org/wiki/California_African_American_Museum) |
| Los Angeles | Watts Towers | Memorial | [Wikipedia](https://en.wikipedia.org/wiki/Watts_Towers) |
| Los Angeles | Charles R. Drew University | Historically Black graduate school | [Wikipedia](https://en.wikipedia.org/wiki/Charles_R._Drew_University_of_Medicine_and_Science) |
| Washington DC | U Street | District | [Wikipedia](https://en.wikipedia.org/wiki/U_Street_(Washington,_D.C.)) |
| Washington DC | Howard University | HBCU | [Wikipedia](https://en.wikipedia.org/wiki/Howard_University) |
| Washington DC | National Museum of African American History and Culture | Museum | [Wikipedia](https://en.wikipedia.org/wiki/National_Museum_of_African_American_History_and_Culture) |
| Washington DC | African American Civil War Memorial | Memorial | [Wikipedia](https://en.wikipedia.org/wiki/African_American_Civil_War_Memorial_Museum) |
| Washington DC | Frederick Douglass National Historic Site | Memorial | [Wikipedia](https://en.wikipedia.org/wiki/Frederick_Douglass_National_Historic_Site) |
| New Orleans | Tremé | District | [Wikipedia](https://en.wikipedia.org/wiki/Trem%C3%A9) |
| New Orleans | Congo Square | Memorial | [Wikipedia](https://en.wikipedia.org/wiki/Congo_Square) |
| New Orleans | Dillard University | HBCU | [Wikipedia](https://en.wikipedia.org/wiki/Dillard_University) |
| New Orleans | Xavier University of Louisiana | HBCU | [Wikipedia](https://en.wikipedia.org/wiki/Xavier_University_of_Louisiana) |
| New Orleans | Southern University at New Orleans | HBCU | [Wikipedia](https://en.wikipedia.org/wiki/Southern_University_at_New_Orleans) |

26 landmarks across the six cities the map flies to.

## Calls for you

1. **Chicago State University is not an HBCU.** It is a predominantly Black institution. The map shows only its name, so nothing on screen claims otherwise. Keep it or cut it.
2. **Charles R. Drew University** is a federally designated Historically Black Graduate Institution, one of four historically Black medical schools. It is not an undergraduate HBCU. Same as above: the map shows only its name.
3. **Two new Chicago suggestions.** Victory Monument honors the all-Black 8th Illinois Infantry of World War I. Roberts Temple is where Emmett Till's open-casket funeral was held in 1955, and it is part of the Emmett Till and Mamie Till-Mobley National Monument. The runner-up was the Ida B. Wells-Barnett House.
4. **Districts are a point, not an area.** For Freedmen's Town, Bronzeville and U Street the source article covers a wider area, so the diamond sits at that area's center. Leimert Park Village uses the point on the Village itself rather than the neighborhood center about half a kilometer north.

## Low-precision points

Atlanta University Center, Freedmen's Town and Xavier are published with only three or four decimal places. That is accurate to roughly 10 to 100 meters, which is fine for a label at city zoom.
