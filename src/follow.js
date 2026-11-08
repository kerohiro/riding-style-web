// Playback follows the selected log sample; recording follows fresh GPS fixes.
export function syncFollow(map,{enabled,recording,sample,fix,initial=false}) {
  const location=recording?fix:sample?{coords:sample}:null;
  if(!enabled || !map || !location)return false;
  map.centerLocation(location,recording && initial);
  return true;
}
