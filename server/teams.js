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

  // Sort by points descending so we snake-draft
  list.sort((a, b) => b.points - a.points);

  const teams = Array.from({ length: numTeams }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    players: [],
    totalPoints: 0,
  }));

  // Snake draft: 0,1,...,n-1 then n-1,...,0
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

  return teams.map(({ id, name, players, totalPoints }) => ({
    id,
    name,
    players: players.map(({ id: pid, name: n, ranking, image }) => ({ id: pid, name: n, ranking, image })),
    totalPoints,
  }));
}
