/**
 * Balance players into numTeams teams by ranking.
 * S is highest, then A, B, C, Unranked.
 * Points: S=4, A=3, B=2, C=1, Unranked=0
 */

const RANK_POINTS = { S: 4, A: 3, B: 2, C: 1, Unranked: 0 };

export function createBalancedTeams(players, numTeams) {
  if (numTeams < 1) throw new Error('numTeams must be at least 1');
  const list = players.map((p) => ({
    ...p,
    points: RANK_POINTS[p.ranking] ?? 0,
  }));

  list.sort((a, b) => b.points - a.points);

  const teams = Array.from({ length: numTeams }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    players: [],
    totalPoints: 0,
  }));

  let teamIndex = 0;
  let step = 1;
  for (const player of list) {
    teams[teamIndex].players.push(player);
    teams[teamIndex].totalPoints += player.points;
    teamIndex += step;
    if (teamIndex >= numTeams) {
      teamIndex = numTeams - 1;
      step = -1;
    } else if (teamIndex < 0) {
      teamIndex = 0;
      step = 1;
    }
  }

  return teams.map(({ id, name, players: pl, totalPoints }) => ({
    id,
    name,
    players: pl.map(({ id: pid, name: n, ranking }) => ({
      id: pid,
      name: n,
      ranking,
    })),
    totalPoints,
  }));
}
