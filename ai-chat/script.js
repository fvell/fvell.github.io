const state = {
  mood: "焦虑",
  mode: "倾听",
};

const messages = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const clearChat = document.querySelector("#clearChat");

document.querySelector("#moodGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-mood]");
  if (!button) return;
  setActive("#moodGrid", button);
  state.mood = button.dataset.mood;
});

document.querySelector("#modeList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (!button) return;
  setActive("#modeList", button);
  state.mode = button.dataset.mode;
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    input.focus();
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addMessage("user", text);
  input.value = "";
  showTyping();

  window.setTimeout(() => {
    removeTyping();
    addMessage("assistant", buildReply(text));
  }, 650);
});

clearChat.addEventListener("click", () => {
  messages.innerHTML = "";
  addMessage(
    "assistant",
    "我们可以重新开始。你可以先说一件最占据你注意力的事，也可以只说一句“我现在很难受”。"
  );
});

function setActive(containerSelector, activeButton) {
  document.querySelectorAll(`${containerSelector} button`).forEach((button) => {
    button.classList.toggle("is-active", button === activeButton);
  });
}

function addMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "assistant" ? "AI" : "你";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  text.split("\n").forEach((line) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    bubble.append(paragraph);
  });

  article.append(avatar, bubble);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
}

function showTyping() {
  const article = document.createElement("article");
  article.className = "message assistant typing";
  article.dataset.typing = "true";
  article.innerHTML = '<div class="avatar">AI</div><div class="bubble"><p>正在整理你的表达...</p></div>';
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
}

function removeTyping() {
  document.querySelector("[data-typing='true']")?.remove();
}

function buildReply(text) {
  const riskWords = ["自杀", "不想活", "伤害自己", "伤害别人", "结束生命"];
  if (riskWords.some((word) => text.includes(word))) {
    return "我很重视你刚才说的内容。如果你现在可能伤害自己或他人，请立刻联系当地紧急服务，或马上找身边可信任的人陪你。\n在等待帮助时，先把危险物品移远，去到有人在的地方，然后只做下一件事：打电话或发消息给一个具体的人。";
  }

  const opener = `听起来你现在主要处在“${state.mood}”的状态里。`;
  const reflection = getReflection(text);
  const modeReply = getModeReply();

  return `${opener}${reflection}\n${modeReply}\n你愿意补充一下：这件事最让你难受的部分，是事实本身、别人的反应，还是你对自己的评价？`;
}

function getReflection(text) {
  if (text.includes("担心") || text.includes("害怕") || text.includes("焦虑")) {
    return "担心反复出现时，大脑常常会把“可能发生”误读成“马上会发生”。";
  }
  if (text.includes("做不好") || text.includes("没用") || text.includes("失败")) {
    return "你提到的自我评价很重，先把“我这个人不行”和“这件事没有做好”分开，会更容易处理。";
  }
  if (text.includes("压力") || text.includes("累") || text.includes("忙")) {
    return "压力大的时候，最需要先降低任务密度，而不是马上要求自己恢复满格。";
  }
  return "你的表达里有一些还没有被完全说清楚的感受，我们可以先不急着解决，先把它们命名。";
}

function getModeReply() {
  if (state.mode === "认知重构") {
    return "可以试着写下三个句子：我脑中最强烈的想法是什么；支持它的证据是什么；有没有一个更温和但仍真实的说法。";
  }
  if (state.mode === "行动计划") {
    return "先选一个 10 分钟内能完成的小动作，比如倒一杯水、列出三件待办、给一个人发一句求助消息。目标不是解决全部问题，而是让身体重新进入可行动状态。";
  }
  return "我先帮你承接一下：这不是矫情，而是你的系统在提醒你某些需求没有被照顾到。先慢一点，描述事实，再描述感受。";
}
