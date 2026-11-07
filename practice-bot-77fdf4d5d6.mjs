import {draw, move, noSideAttack, playFromHandError} from './engine-3ec9e8cad9.mjs';
import {facingPosition, stagePositions} from './context-actions-0858fa1f2e.mjs';

const bot = 1;
const ref = (p, z, card) => ({p, z, uid: card.uid});
const choicePlayer = (match, choice) =>
  choice.p ?? choice.task?.p ?? choice.ref?.p ?? choice.options[0]?.ref?.p ??
  match.auto.attack?.p ?? match.active;

export function practiceMulligan(match, player, cards) {
  if (match.botOpening !== player) throw Error('Wait for the other player to mulligan.');
  const side = match.players[player];
  move(match, cards, player, 'waiting');
  draw(match, player, cards.length);
  side.mulligan = true;
  match.botOpening = match.players[1 - player].mulligan ? null : 1 - player;
}

export function nextPracticeBotAction(match, catalog, resolver) {
  if (!match.practiceBot) return null;
  const auto = resolver.auto(match);
  if (!auto.enabled || auto.gameOver || auto.paused || auto.reveal || match.cost) return null;
  const zones = match.players[bot].zones;
  const action = (label, run) => ({label: 'Practice bot · ' + label, run});
  const advance = () => action('Advance phase', () => resolver.advance(match));
  const definition = card => catalog.get(card.id);
  const score = card => {
    const data = definition(card);
    if (!data) return 0;
    if (data.type !== 'Character') return 1;
    return 2 + (Number(data.level) === 0 ? 3 : 0) + (Number(data.power) || 0) / 10000;
  };
  if (match.botOpening != null) {
    if (match.botOpening !== bot) return null;
    const cards = zones.hand.filter(card => {
      const data = definition(card);
      return data && (data.type !== 'Character' || Number(data.level) > 0);
    }).map(card => ref(bot, 'hand', card));
    return action('Mulligan ' + cards.length + ' card(s)', () => practiceMulligan(match, bot, cards));
  }

  const choice = auto.choice;
  if (choice) {
    if (choicePlayer(match, choice) !== bot || ['blocked', 'unknown-icon', 'auto-manual'].includes(choice.kind)) return null;
    let option;
    if (choice.kind === 'ability-offer') {
      option = choice.options.find(item => item.value === 'resolve');
    } else if (choice.kind === 'ability-count') {
      option = choice.options.at(-1);
    } else if (choice.kind === 'discard') {
      option = [...choice.options].sort((a, b) => score({id:a.card}) - score({id:b.card}))[0];
    } else if (choice.kind === 'counter' && auto.attack?.defender) {
      const attacker = resolver.stats(match, auto.attack.ref).power;
      const defender = resolver.stats(match, auto.attack.defender).power;
      option = choice.options.find(item => item.backup && defender <= attacker && defender + item.backup.power > attacker);
    } else if (choice.kind === 'standby-position') {
      option = choice.options.find(item => !zones[item.value].length);
    } else if (choice.kind === 'optional-top') {
      option = choice.options.find(item => item.value === 'yes');
    } else if (choice.kind === 'trigger-target') {
      option = choice.options.find(item => item.value !== 'pass' &&
        (choice.icon !== 'STANDBY' || stagePositions.some(z => !zones[z].length)));
    } else if (choice.kind === 'manual-counter') {
      option = choice.options.find(item => item.value === 'cancel');
    }
    option ??= choice.options.find(item => item.value === 'pass') ?? choice.options.find(item => !item.disabled);
    if (option) return action(option.label, () => resolver.respond(match, choice.id, option.value));
    return null;
  }
  if (auto.queue.length) return action('Continue resolution', () => resolver.run(match));
  if (auto.attack || match.active !== bot) return null;

  if (match.phase === 2 && match.clockedTurn !== match.turn && zones.hand.length < 7 && zones.level.length < 3) {
    const card = [...zones.hand].sort((a, b) => score(a) - score(b))[0];
    if (card) return action('Clock one and draw two', () => {
      move(match, [ref(bot, 'hand', card)], bot, 'clock');
      match.clockedTurn = match.turn;
      resolver.drawCards(match, bot, 2);
    });
  }
  const colors = new Set([...zones.clock, ...zones.level].map(card => definition(card)?.color));
  if (match.phase === 3) {
    const slot = stagePositions.find(z => !zones[z].length);
    const playable = zones.hand.filter(card => {
      const data = definition(card);
      return data?.type === 'Character' && !playFromHandError(data, zones, match.phase, id => catalog.get(id));
    });
    const card = playable.sort((a, b) => Number(definition(b).power) - Number(definition(a).power))[0];
    if (slot && card && !(match.turn === 1 && stagePositions.some(z => zones[z].length))) {
      return action('Play ' + definition(card).name, () => {
        const cost = Number(definition(card).cost) || 0;
        if (cost) move(match, zones.stock.slice(-cost).reverse().map(c => ref(bot, 'stock', c)), bot, 'waiting');
        move(match, [ref(bot, 'hand', card)], bot, slot);
      });
    }
  }
  if (match.phase === 4 && !zones.climax.length && stagePositions.slice(0, 3).some(z => zones[z].length)) {
    const card = zones.hand.find(c => definition(c)?.type === 'Climax' && colors.has(definition(c).color));
    if (card) return action('Play climax', () => move(match, [ref(bot, 'hand', card)], bot, 'climax'));
  }
  if (match.phase === 5 && !(match.turn === 1 && match.attacksThisTurn >= 1)) {
    for (const z of stagePositions.slice(0, 3)) {
      const card = zones[z].at(-1);
      if (card?.orientation !== 'stand' || definition(card)?.type !== 'Character') continue;
      const opponentZone = facingPosition(z);
      const opposing = match.players[0].zones[opponentZone].at(-1);
      const attacker = ref(bot, z, card);
      let type = 'direct';
      if (opposing) {
        const own = resolver.stats(match, attacker);
        const defender = resolver.stats(match, ref(0, opponentZone, opposing));
        type = !(definition(card)?.ability||[]).flatMap(text=>text.split('\n')).some(noSideAttack) && own.power < defender.power && own.soul > defender.level ? 'side' : 'frontal';
      }
      return action(type + ' attack', () => resolver.beginAttack(match, attacker, type));
    }
  }
  return advance();
}
