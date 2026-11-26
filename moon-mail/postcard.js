const serif = '"Songti SC","Noto Serif CJK SC",SimSun,Georgia,serif';
const sans = '"PingFang SC","Microsoft YaHei UI",system-ui,sans-serif';

function wrapLines(ctx, text, width) {
  const lines = [];
  for (const paragraph of text.replace(/\n{3,}/g, "\n\n").split("\n")) {
    let line = "";
    const tokens = paragraph.match(/[a-z0-9]+(?:['’-][a-z0-9]+)*|[^\S\n]+|[^\s]/giu) || [];
    for (const token of tokens) {
      if (line && ctx.measureText(line + token).width > width) {
        lines.push(line.trimEnd());
        line = "";
      }
      if (!line && !token.trim()) continue;
      if (ctx.measureText(token).width <= width) {
        line += token;
        continue;
      }
      for (const char of token) {
        if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ""; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function postcardPNG(letter, number, message, language, t, postscript, proof, backTitle = "onTheBack", proofTitle = "contactTitle") {
  const image = new Image();
  image.src = letter.image;
  await image.decode();
  const canvas = document.createElement("canvas");
  const width = 1200;
  const margin = 56;
  const inside = width - 2 * margin;
  canvas.width = width;
  const ctx = canvas.getContext("2d");
  const bodyFont = "37px " + serif;
  ctx.font = bodyFont;
  const lines = wrapLines(ctx, message, inside - 20);
  const replyFont = "30px " + serif;
  ctx.font = replyFont;
  const replyLines = postscript ? wrapLines(ctx, postscript, inside - 60) : [];
  const artHeight = Math.round(inside * image.naturalHeight / image.naturalWidth);
  const titleY = 112 + artHeight + 88;
  const messageY = titleY + 74;
  const foldY = messageY + lines.length * 64;
  const foldHeight = replyLines.length ? 90 + replyLines.length * 47 : 0;
  const proofHeight = proof ? Math.round(inside * proof.height / proof.width) : 0;
  canvas.height = foldY + foldHeight + (proof ? proofHeight + 62 : 0) + 114;
  ctx.fillStyle = "#fbf6e8";
  ctx.fillRect(0, 0, width, canvas.height);
  for (let x = -12, i = 0; x < width + 12; x += 43, i++) {
    ctx.fillStyle = i % 2 ? "#497378" : "#b9664f";
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 25, 0); ctx.lineTo(x + 16, 14); ctx.lineTo(x - 9, 14);
    ctx.fill();
  }
  ctx.fillStyle = "#25494e";
  ctx.font = "bold 32px " + serif;
  ctx.fillText(t("title"), margin, 76);
  ctx.font = "bold 23px monospace";
  ctx.fillStyle = "#95654d";
  if (language === "zh") ctx.fillText("MOONLIGHT POST", margin + 160, 75);
  ctx.textAlign = "right";
  ctx.fillText("NO. " + String(number).padStart(2, "0"), width - margin, 75);
  ctx.textAlign = "left";
  ctx.drawImage(image, margin, 112, inside, artHeight);
  ctx.fillStyle = "#183b40";
  ctx.font = "bold 55px " + serif;
  ctx.fillText(letter.title, margin, titleY);
  ctx.fillStyle = "#294b49";
  ctx.font = bodyFont;
  lines.forEach((line, i) => ctx.fillText(line, margin + 2, messageY + i * 64));
  if (replyLines.length) {
    ctx.fillStyle = "#e4ece0";
    ctx.fillRect(margin, foldY, inside, foldHeight);
    ctx.fillStyle = "#315854";
    ctx.font = "bold 25px " + sans;
    ctx.fillText("◇  " + t(backTitle), margin + 27, foldY + 41);
    ctx.font = replyFont;
    replyLines.forEach((line, i) => ctx.fillText(line, margin + 27, foldY + 88 + i * 47));
  }
  if (proof) {
    ctx.fillStyle = "#315854";
    ctx.font = "bold 26px " + sans;
    ctx.fillText(t(proofTitle), margin, foldY + foldHeight + 27);
    ctx.drawImage(proof, margin, foldY + foldHeight + 48, inside, proofHeight);
  }
  const baseline = canvas.height - 54;
  ctx.strokeStyle = "#c7bfab";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(margin, baseline - 47); ctx.lineTo(width - margin, baseline - 47); ctx.stroke();
  ctx.fillStyle = "#586b60";
  ctx.font = "26px " + sans;
  ctx.fillText(letter.place + "  ·  " + letter.time + " " + t("postRun"), margin, baseline);
  ctx.textAlign = "right";
  ctx.fillStyle = "#a3523f";
  ctx.fillText(t("printMark"), width - margin, baseline);
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error("PNG encoding failed"));
  }, "image/png"));
}
