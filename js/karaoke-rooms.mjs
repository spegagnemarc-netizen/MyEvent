export function mountKaraokeRooms(panel, play, stop) {
  const context = () => window.myeventGameContext?.() || {};
  const config = window.myeventRuntime?.ready;
  let session, result, busy, generation = 0;
  let turnKey;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const content = document.createElement('div');
  panel.append(status, content);

  function node(tag, value, parent = content) {
    const element = document.createElement(tag);
    element.textContent = value;
    parent.append(element);
    return element;
  }

  function button(label, callback) {
    const element = node('button', label);
    element.type = 'button';
    element.disabled = Boolean(busy);
    element.onclick = callback;
  }

  async function run(callback) {
    if (busy) return;
    const token = generation;
    busy = true;
    status.textContent = '';
    render();
    try {
      await callback();
    } catch (error) {
      if (token === generation) status.textContent = error.message || 'Connexion interrompue.';
    } finally {
      if (token === generation) {
        busy = false;
        render();
      }
    }
  }

  function render() {
    content.replaceChildren();
    node('h3', 'Karaoké entre amis');
    const state = session?.state;
    if (!state) {
      if (!context().user) {
        node('p', 'Connectez-vous avec un compte TEST pour jouer entre amis.');
        return;
      }
      button('Créer un salon privé', () => run(() => session.create({})));
      const input = node('input', '');
      input.setAttribute('aria-label', 'Code du salon');
      input.placeholder = 'Code du salon';
      button('Rejoindre', () => run(async () => {
        await session.join(input.value.trim());
      }));
      return;
    }

    const {room, players, me, scores} = state;
    const active = players.filter(player => !player.left_at);
    const name = id => players.find(player => player.user_id === id)?.name || 'Joueur';
    const actor = room.settings.queue?.[room.round_no - 1];
    const key = room.status === 'playing' ? room.id + ':' + room.round_no : null;
    if (key !== turnKey) {
      if (turnKey) stop();
      turnKey = key;
      result = undefined;
    }
    node('p', 'Code du salon · ' + room.code);
    node('p', active.map(player => player.name).join(', '));

    if (room.status === 'waiting') {
      button('Inviter des amis', async () => {
        const current = session;
        try {
          const contacts = await current.rpc('game_contacts', {target_room: room.id});
          if (current !== session || !content.contains(contactsList)) return;
          contactsList.replaceChildren();
          for (const friend of contacts) {
            const invite = node('button', 'Inviter ' + friend.name, contactsList);
            invite.type = 'button';
            invite.onclick = () => run(async () => {
              await current.act('invite', {target: friend.id});
              status.textContent = 'Invitation envoyée dans le Salon Jeux.';
            });
          }
          if (!contacts.length) node('p', 'Aucun ami à inviter. Vous pouvez partager le code du salon.', contactsList);
        } catch (error) {
          if (current === session) status.textContent = error.message;
        }
      });
      const contactsList = node('div', '');
      if (room.host_id === me && active.length >= 2) button('Lancer la partie', () => run(() => session.act('start')));
    }

    if (room.status === 'playing') {
      node('p', actor === me ? 'C’est votre tour.' : 'Au tour de ' + name(actor));
      if (actor === me && result === undefined) {
        button('Autoriser le micro et chanter pour le salon', () => {
          void play(true, score => {
            if (key !== turnKey) return;
            result = score;
            void run(() => session.act('finish', {turn: room.round_no, score}));
          });
        });
      }
      if (actor === me && result !== undefined) {
        button('Renvoyer mon résultat', () => run(() => session.act('finish', {turn: room.round_no, score: result})));
      }
      if (actor === me || room.host_id === me) {
        button('Passer ce tour', () => run(() => session.act('skip', {turn: room.round_no})));
      }
    }

    if (room.status === 'finished') node('p', 'Partie terminée.');
    node('h4', 'Classement du salon');
    const ranking = node('ol', '');
    for (const score of [...scores].sort((a, b) => b.points - a.points || a.round_no - b.round_no)) {
      node('li', name(score.user_id) + ' · ' + score.points + ' / 100', ranking);
    }
    if (!scores.length) node('p', 'Aucun score partagé.');
    button('Quitter le salon', () => run(() => session.leave()));
  }

  return {
    async open(roomId) {
      const token = generation;
      const env = await config?.catch(() => null);
      if (token !== generation || env?.environment !== 'preview' || env.isTest !== true ||
          env.projectRef !== 'ahyyknfjsielnqyoxqgh' || !window.MyEventGameSession) return;
      if (!session) {
        const Session = window.MyEventGameSession;
        session = new class extends Session {
          endpoint(kind) {
            return kind === 'snapshot' ? 'game_snapshot' : super.endpoint(kind);
          }
        }(context, 'karaoke');
        session.addEventListener('state', render);
        session.addEventListener('error', event => { status.textContent = event.detail.message; });
      }
      panel.hidden = false;
      if (roomId) await run(() => session.connect(roomId));
      render();
    },
    close() {
      generation++;
      session?.disconnect();
      session = undefined;
      busy = false;
      result = undefined;
      turnKey = undefined;
      panel.hidden = true;
      status.textContent = '';
    },
  };
}
