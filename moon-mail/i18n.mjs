const copy = {
  title: ["月光邮局", "Moonlight Post"],
  pageTitle: ["月光邮局 · 女友小游戏", "Moonlight Post · Mini Games"],
  description: ["转动镜片，穿越潮门，把九封沿海来信与回信寄给远方的人。", "Turn mirrors, cross tide gates and deliver nine illustrated letters along the coast and back."],
  nav: ["游戏导航", "Game navigation"], back: ["小游戏", "Games"], album: ["明信片夹", "Postcard album"],
  albumNav: ["信夹", "Album"], settings: ["设置", "Settings"], close: ["关闭", "Close"],
  otherLanguage: ["English", "简体中文"], switchLanguage: ["Switch to English", "切换为简体中文"],
  motto1: ["转动海上的镜片，", "Turn the mirrors."], motto2: ["让月光替你送信。", "Send a little moonlight."],
  chart: ["投递航图", "Route chart"], turns: ["步数", "Turns"], stamps: ["邮戳", "Stamps"],
  chartAccess: ["月光航图，圆形镜片可以转动", "Moonlight route chart. Round mirrors can be rotated."],
  notesAccess: ["本封信和玩法", "Station postcard and instructions"], fieldNotes: ["投递手记", "Postmaster’s notes"],
  guide: ["航图图例与玩法", "Chart symbols and rules"], moon: ["月光源", "Moon lamp"], mirror: ["可转圆镜", "Mirror"],
  box: ["收信箱", "Mailbox"], reef: ["挡光礁石", "Reef"], mark: ["沿途邮戳", "Postmark"], gate: ["成对潮门", "Tide gate"],
  numbered: ["顺序邮戳", "Numbered seal"],
  instructions: ["点一下圆镜旋转 90°。让同一束光经过所有邮戳再照到信箱。编号邮戳按首次经过的先后盖章。键盘可用 Tab 选镜，空格或回车旋转。", "Turn a mirror 90° with a tap. Send one beam through every stamp and into the mailbox. Numbered seals count in the order the beam first visits them. Use Tab to select a mirror and Space or Enter to turn it."],
  undo: ["撤销", "Undo"], reset: ["重来", "Reset"], hint: ["提示", "Hint"], send: ["寄出月光", "Send letter"],
  sending: ["投递中…", "In transit…"], read: ["拆开来信", "Read letter"], postRun: ["邮班", "dispatch"],
  coast: ["沿海夜邮", "Coastal night mail"], replies: ["回信篇", "Return letters"],
  chapters: ["选择篇章", "Choose a chapter"], difficulty: ["航线难度", "Route difficulty"],
  modeControl: ["更改难度，当前为{mode}", "Change difficulty, currently {mode}"],
  relaxed: ["轻松", "Relaxed"], standard: ["标准", "Standard"], expert: ["挑战", "Expert"],
  relaxedHelp: ["部分镜片已对准，循着虚线提示再转一两步。", "Some mirrors are already aligned. Follow the dashed ring for the last one or two turns."],
  standardHelp: ["自由转镜，需要时可以查看下一步提示。", "Take as many turns as you like. Ask for a hint when you want one."],
  expertHelp: ["每站都有另一张航图。用最少步数送达，可撤销返还步数。", "Each station has a different chart. Deliver in the fewest turns. Undo gives a turn back."],
  separateRuns: ["每档分别保存路线与最佳步数。", "Each difficulty keeps its own route and best score."],
  audio: ["音效", "Sound effects"], soundOn: ["音效开", "Sound on"], soundOff: ["音效关", "Sound off"],
  volume: ["音量", "Volume"], listen: ["试听", "Preview"], resume: ["回到航图", "Back to chart"],
  busyStatus: ["信件正在沿着月光航行……", "Your letter is travelling along the beam…"],
  deliveredStatus: ["月光已送达，来信可以拆开了。", "Your letter has arrived. Open it to read the postcard."],
  hintStatus: ["试着转一下 {cell} 的圆镜。", "Try turning the mirror at {cell}."],
  guidedStatus: ["跟着虚线，转动 {cell} 的圆镜。", "Follow the dashed ring and turn the mirror at {cell}."],
  readyStatus: ["邮路接通了！现在可以寄出这封信。", "The route is connected. Your letter is ready to send."],
  missingStatus: ["光已照到信箱，还差 {n} 枚邮戳。", "The beam reached the mailbox. Collect {n} more before sending."],
  orderStatus: ["盖章顺序为 {actual}，需要 {expected}。", "The beam stamped {actual}. It needs {expected}."],
  blockedStatus: ["前面有阻挡，试试让月光从另一侧经过。", "The beam is blocked. Try a different approach."],
  loopStatus: ["月光绕回了原处，转一面镜子打开出口。", "The beam doubled back. Turn a mirror to find a way out."],
  firstStatus: ["点一下 D3 圆镜，让光照到 D1 的信箱。", "Turn the mirror at D3 to light the mailbox at D1."],
  seaStatus: ["月光从海图边缘溜走了，再找一个转弯的方向。", "The light slipped out to sea. Try another turn."],
  budgetStart: ["这条挑战邮路需要 {n} 步。先看看信箱，再决定第一步。", "This chart takes {n} turns. Find the mailbox before making the first move."],
  exhausted: ["步数已用完，可以撤销一步或重新出发。", "Out of turns. Undo a move or reset the route to try again."],
  budgetAccess: ["已用 {used} 步，可用 {total} 步", "{used} of {total} turns used"],
  albumSummary: ["{mode}档已送达 {done}/{total} 封。选一站出发，或重读来信。", "{mode} · {done}/{total} delivered. Choose a station or reread a postcard."],
  albumComplete: ["{mode}档的九封信都到了。选一张重读，或写成自己的明信片。", "All nine letters delivered on {mode}. Reread a card or make it your own."],
  delivered: ["已送达", "Delivered"], albumBest: ["已送达 · 最佳 {n} 步", "Delivered · best in {n} turns"],
  albumBestOne: ["已送达 · 最佳 1 步", "Delivered · best in 1 turn"], inProgress: ["正在投递", "On the chart"], visit: ["前往投递", "Start route"],
  next: ["下一站", "Next stop"], nextChapter: ["开启回信篇", "Start the replies"], backToAlbum: ["回到信夹", "Back to album"],
  writeLabel: ["写给收信人的话", "Your message"], noteLimit: ["限 200 字，留空恢复原文", "Up to 200 characters. Leave blank for the original."],
  saveNote: ["保存寄语", "Save message"], cancel: ["取消", "Cancel"], edit: ["改写寄语", "Edit message"],
  saveImage: ["保存图片", "Save image"], openImage: ["打开图片", "Open image"], replay: ["重走这段邮路", "Replay route"],
  printing: ["正在印制明信片……", "Printing your postcard…"], printed: ["明信片已生成。", "Your postcard is ready."],
  exportFailed: ["图片未能生成，请再试一次。", "The image could not be created. Please try again."],
  printMark: ["月光已送达", "Delivered by moonlight"],
  lampLabel: ["向{direction}发出的月光源", "Moon lamp pointing {direction}"],
  east: ["东", "east"], south: ["南", "south"], west: ["西", "west"], north: ["北", "north"],
  rising: ["左下至右上", "bottom left to top right"], falling: ["左上至右下", "top left to bottom right"],
  mirrorLabel: ["{cell} 圆镜，{slope}", "Mirror at {cell}, {slope}"], hinted: ["，提示位置", ", suggested mirror"],
  sealLabel: ["{n} 号邮戳", "Seal {n}"], lit: ["已点亮", "lit"], unlit: ["未点亮", "unlit"],
  routeFrom: ["月光从 {cell} 出发。", "Light starts at {cell}."],
  routeVia: ["依次经过圆镜 {cells}。", "It meets the mirrors at {cells} in order."], routeTo: ["信箱在 {cell}。", "The mailbox is at {cell}."],
};

export function chooseLanguage(saved, languages) {
  if (saved === "zh" || saved === "en") return saved;
  for (const locale of languages) {
    const base = locale.toLowerCase().split("-")[0];
    if (base === "zh" || base === "en") return base;
  }
  return "zh";
}

export function translator(language) {
  const column = language === "en" ? 1 : 0;
  return (key, values = {}) => copy[key][column].replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
}
