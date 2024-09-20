Ranks all XC teams in input.txt, sample data for De La Salle 2024

Based on the input, each team is put into the athletic.net search and the first option that pops up is what is used for data. If it's incorrect, in the input you can replace the team name with it's athletic.net team id (found in url)

Rankings are done by scraping data from the team's athletic.net results grid. The team average time is found for each meet. The courses in courseInfo.json contains data to adjust times for elevation gain (10ft = -1s), difficulty, and incorrect course length. It then converts the time for that distance to the 3 mile distance, also slowing down the pace for shorter courses and speeding up the pace for longer courses. 

final time = time * 3 / (distance + (distance - 3) / 20)

The best 3 meets times are used as so:
if there are 3 or more meets, the weight is 0.6(#1) + 0.25(#2) + 0.15(#3)
for 2 meets, 0.7(#1) + 0.3(#2)
for 1 meet, 1(#1) (obviously)

The output has ~ as a delimeter so you paste it in a spreadsheet and set the delimiter to put it in separate cells. courseList.json is a cache file you dont need to make it