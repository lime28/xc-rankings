import jsdom from 'jsdom';
const { JSDOM } = jsdom;
import { promises as fs } from 'fs';
import fetch from 'node-fetch';

function timeToMinutes(time) {
  const [minutes, seconds] = time.split(':').map(parseFloat);
  return minutes + (seconds / 60);
}

function minutesToTime(minutes) {
  const min = Math.floor(minutes);
  const sec = (minutes - min) * 60;
  const formattedSeconds = sec.toFixed(1).padStart(4, '0');
  
  return `${min}:${formattedSeconds}`;
}

function convertDistance(distanceString) {
  const [length, unit] = distanceString.split(' ');
  const distance = parseFloat(length.replace(/,/g, ''));
  if (unit === 'Miles') {
    return distance;
  } else if (unit === 'Meters') {
    return distance * .000621371;
  } else {
    throw new Error(`Unknown unit: ${unit}`);
  }
}

const results = [];
const noResults = [];
const courseListData = await fs.readFile('courseList.json', 'utf8');
let courseList = JSON.parse(courseListData);
const courseInfoData = await fs.readFile('courseInfo.json', 'utf8');
let courseInfo = JSON.parse(courseInfoData);

async function addTeamTimes(teamId) {
  const response = await fetch(`https://www.athletic.net/CrossCountry/Results/Season.aspx?SchoolID=${teamId}&S=2024`);
  const text = await response.text();
  const dom = new JSDOM(text);
  const doc = dom.window.document;
  const meta = await fetch(`https://www.athletic.net/api/v1/TeamNav/Team?team=${teamId}&sport=xc&season=2024`)
  const md = await meta.json();
  const teamName = md.team.Name
  const teamLocation = md.team.City + ', ' + md.team.State;

  const teamAverages = [];

  let meetList = doc.querySelector('#MeetList tbody');
  if (meetList) {
    meetList = meetList.children;
  } else {
    noResults.push([teamName, teamLocation]);
    return;
  }
  const numMeets = meetList.length - 1;
  const distanceList = doc.querySelector('.pull-right-sm tbody').children;

  for (let i = 0; i < numMeets; i++) {
    const meet = []
    const meetName = meetList[i+1].querySelector('a').textContent;
    let course
    const foundTimes = doc.querySelectorAll(`.td${i+1}.d`);
    if (courseList[meetName]) {
      course = courseList[meetName];
    } else {
      const meetId = meetList[i+1].querySelector('a').href.split('/')[3];
      let response = await fetch(`https://www.athletic.net/api/v1/Meet/GetMeetData?meetId=${meetId}&sport=xc`);
      let data = await response.json();
      course = data.meet.Location.Name;
      courseList[meetName] = course;
    }

    for (const t of foundTimes) {
      let time = timeToMinutes(t.querySelector('a').textContent);
      if (time == NaN || time == undefined) {
        continue;
      }
      let distId = t.querySelector('.subscript').textContent;
      let distance = distanceList[distId].querySelector('td').textContent.substring(1);
      let convertedDistance = Math.round(convertDistance(distance) * 100)/100;

      if (courseInfo[course] && courseInfo[course][convertedDistance]) {
        let info = courseInfo[course][convertedDistance];
        if (info.elevation) {
          time -= (info.elevation / 60) / 10;
        }
        if (info.distance) {
          convertedDistance = info.distance
        }
        if (info.difficulty) {
          time /= info.difficulty;
        }
      }

      // takes in to account short courses being faster and long courses being slower
      let converted = time * 3 / (convertedDistance + (convertedDistance - 3) / 20);
      meet.push(converted);
    }
    if (meet.length < 5) {
      continue;
    }
    meet.sort((a, b) => a - b);
    let teamScore = (meet.slice(0, 5).reduce((a, b) => a + b, 0)) / 5;
    if (teamScore == NaN || teamScore == undefined) {
      console.log('error');
      continue;
    }
    teamAverages.push([teamScore, meetName]);
  }

  teamAverages.sort((a, b) => a[0] - b[0]);

  let finalTeamAverage
  let meetNames = teamAverages.slice(0, Math.min(3, teamAverages.length)).map(([_, name]) => name);
  if (teamAverages.length > 2) {
      finalTeamAverage = teamAverages[0][0] * 0.6 + teamAverages[1][0] * 0.25 + teamAverages[2][0] * 0.15;
  } else if (teamAverages.length === 2) {
      finalTeamAverage = teamAverages[0][0] * 0.7 + teamAverages[1][0] * 0.3;
  } else if (teamAverages.length === 1) {
      finalTeamAverage = teamAverages[0][0];
  } else {
    noResults.push([teamName, teamLocation]);
    return;
  }

  results.push([teamName, teamLocation, finalTeamAverage, meetNames]);
}

async function getRelevantTeamId(team) {
  const response = await fetch(`https://www.athletic.net/api/v1/AutoComplete/search?q=${encodeURIComponent(team)}&fq=t:t`);
  let data = await response.json();
  data = data.response.docs
  for (let i = 0; i < 10; i++) {
    if (!data[i]) {
      break;
    }
    if (data[i]['type'] === 'Team' && data[i]['l'][0] == 4) {
      return data[i]['id_db'];
    }
  }

  console.log('Could not find team:', team);
}

const inputString = await fs.readFile('input.txt', 'utf8');
const teams = inputString.split('\n');

async function processTeams(teams) {
  const teamPromises = teams.map(async (team) => {
    let teamId = parseFloat(team);
    if (teamId) {
      return addTeamTimes(teamId);
    }
    // Remove section (example (CC)) if needed
    team = team.replace(/\s\([A-Za-z]{2}\)$/, '');

    teamId = await getRelevantTeamId(team);
    if (teamId) {
      return addTeamTimes(teamId);
    } else {
      return null;
    }
  });

  await Promise.all(teamPromises);
  return true
}

await processTeams(teams);

results.sort((a, b) => a[2] - b[2]);

let output = results.map(([teamName, teamLocation, finalTeamAverage, meetNames]) => `${teamName} (${teamLocation})~${minutesToTime(finalTeamAverage)}~${meetNames.join('~')}`).join('\n');
output += "\n" + noResults.map(([teamName, teamLocation]) => `${teamName} (${teamLocation})~No results`).join('\n');
console.log(output);

fs.writeFile('courseList.json', JSON.stringify(courseList, null, 2));