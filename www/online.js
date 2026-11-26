(function () {
  "use strict";
  const URL = "https://lltldlpfcxrmceifkwsm.supabase.co";
  const KEY = "sb_publishable_H6AJNrLeF5ok4wVcNSwIRQ_SMdI-s7d";
  const $ = (id) => document.getElementById(id);
  let client = null, session = null, room = null, channel = null;
  function authMessage(message) { $("onlineAuthStatus").textContent = message; }
  function roomMessage(message) { $("roomStatus").textContent = message; }
  function refreshAuth() {
    $("onlineAuth").hidden = !!session;
    $("onlineLobby").hidden = !session;
    if (session) { $("onlineUserLabel").textContent = "Signed in as " + (session.user.email || "GKEET player"); if (!$("lobbyPlayerName").value) $("lobbyPlayerName").value = session.user.user_metadata?.display_name || "Player"; }
  }
  function renderPlayers(players) {
    const box = $("onlinePlayers");
    box.replaceChildren();
    (players || []).forEach((player) => {
      const item = document.createElement("div");
      item.className = "onlinePlayer";
      item.textContent = (player.player_name || "Player") + (player.user_id === session.user.id ? " (YOU)" : "");
      box.append(item);
    });
    if (!players || !players.length) {
      const item = document.createElement("div");
      item.className = "onlinePlayer";
      item.textContent = "Waiting for players…";
      box.append(item);
    }
  }
  async function loadMembers() {
    if (!room) return;
    const result = await client.from("gkeet_room_members").select("user_id,player_name").eq("room_id", room.id).order("joined_at");
    if (result.error) { roomMessage(result.error.message); return; }
    renderPlayers(result.data);
  }
  async function enterRoom(roomId, knownCode) {
    const result = await client.from("gkeet_rooms").select("id,code,status,max_players").eq("id", roomId).single();
    if (result.error) { roomMessage(result.error.message); return; }
    room = result.data;
    $("roomDetails").hidden = false;
    $("roomCodeDisplay").textContent = knownCode || room.code;
    roomMessage("Connecting to live room…");
    await loadMembers();
    if (channel) await client.removeChannel(channel);
    channel = client.channel("gkeet:room:" + room.id, { config: { private: true, presence: { key: session.user.id } } });
    channel.on("presence", { event: "sync" }, () => {
      const peers = Object.values(channel.presenceState()).flat().map((peer) => ({
        user_id: peer.user_id, player_name: peer.player_name
      }));
      if (peers.length) renderPlayers(peers);
    });
    channel.on("broadcast", { event: "room_refresh" }, loadMembers);
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: session.user.id, player_name: $("lobbyPlayerName").value.trim() || session.user.user_metadata?.display_name || "Player" });
        roomMessage("LIVE LOBBY CONNECTED • Share the code with friends.");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        roomMessage("Realtime connection failed. Check room access and Realtime settings.");
      }
    });
  }
  async function createRoom() {
    if (!session) return;
    const name = $("onlineName").value.trim() || "Player";
    const created = await client.from("gkeet_rooms").insert({ owner_id: session.user.id, max_players: 6 }).select("id,code").single();
    if (created.error) { roomMessage("Create room failed: " + created.error.message); return; }
    const joined = await client.from("gkeet_room_members").insert({
      room_id: created.data.id, user_id: session.user.id, player_name: name
    });
    if (joined.error) { roomMessage("Room created but joining failed: " + joined.error.message); return; }
    await enterRoom(created.data.id, created.data.code);
  }
  async function joinRoom() {
    if (!session) return;
    const code = $("roomCode").value.trim().toUpperCase();
    const name = $("onlineName").value.trim() || "Player";
    if (code.length !== 6) { roomMessage("Enter the 6-character room code."); return; }
    const result = await client.rpc("gkeet_join_room_by_code", { p_code: code, p_player_name: name });
    if (result.error) { roomMessage("Join failed: " + result.error.message); return; }
    await enterRoom(result.data, code);
    if (channel) await channel.send({ type: "broadcast", event: "room_refresh", payload: { at: Date.now() } });
  }
  async function leaveRoom() {
    if (channel) { await client.removeChannel(channel); channel = null; }
    if (room && session) await client.from("gkeet_room_members").delete().eq("room_id", room.id).eq("user_id", session.user.id);
    room = null;
    $("roomDetails").hidden = true;
    roomMessage("You left the room.");
  }
  $("onlineBack").onclick = () => {
    ["home", "maps", "onlinePanel", "game"].forEach((id) => $(id).classList.remove("on"));
    $("home").classList.add("on");
  };
  $("online").onclick = () => {
    ["home", "maps", "onlinePanel", "game"].forEach((id) => $(id).classList.remove("on"));
    $("onlinePanel").classList.add("on");
    refreshAuth();
  };
  if (!window.supabase || !window.supabase.createClient) {
    authMessage("Online service could not load. Check your internet connection.");
    return;
  }
  client = window.supabase.createClient(URL, KEY);
  client.auth.getSession().then(({ data }) => { session = data.session; refreshAuth(); });
  client.auth.onAuthStateChange((_event, nextSession) => { session = nextSession; refreshAuth(); });
  $("onlineSignIn").onclick = async () => {
    const result = await client.auth.signInWithPassword({ email: $("onlineEmail").value.trim(), password: $("onlinePassword").value });
    authMessage(result.error ? result.error.message : "Signed in successfully.");
  };
  $("onlineSignUp").onclick = async () => {
    const name = $("onlineName").value.trim();
    if (!name) { authMessage("Enter a player name first."); return; }
    const result = await client.auth.signUp({
      email: $("onlineEmail").value.trim(), password: $("onlinePassword").value,
      options: { data: { display_name: name } }
    });
    authMessage(result.error ? result.error.message :
      (result.data.session ? "Account created. You are signed in." : "Account created. Check your email to confirm, then sign in."));
  };
  $("createRoom").onclick = createRoom;
  $("quickRoom").onclick = createRoom;
  $("joinRoom").onclick = joinRoom;
  $("leaveRoom").onclick = leaveRoom;
  $("copyRoomCode").onclick = async () => {
    if (!room) return;
    try { await navigator.clipboard.writeText(room.code); roomMessage("Room code copied."); }
    catch (_) { roomMessage("Room code: " + room.code); }
  };
  $("onlineSignOut").onclick = async () => { await leaveRoom(); await client.auth.signOut(); authMessage("Signed out."); };
  $("onlineBack").onclick = () => {
    ["home", "maps", "onlinePanel", "game"].forEach((id) => $(id).classList.remove("on"));
    $("home").classList.add("on");
  };
  $("online").onclick = () => {
    ["home", "maps", "onlinePanel", "game"].forEach((id) => $(id).classList.remove("on"));
    $("onlinePanel").classList.add("on");
    refreshAuth();
  };
})();