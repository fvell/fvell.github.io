const state = {
  mood: "焦虑",
  mode: "苏格拉底",
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
    "我们重新开始。先不要急着证明你是对的或错的，只说出那个最困扰你的问题：它究竟在向你要求什么？"
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
  article.innerHTML = '<div class="avatar">AI</div><div class="bubble"><p>正在沉思你的问题...</p></div>';
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

  const profile = analyzeText(text);
  const opener = getPhilosophicalOpening(profile);
  const reflection = getReflection(profile);
  const modeReply = getModeReply(profile);
  const question = getQuestion(profile);
  const practice = getPractice(profile);

  return `${opener}\n${reflection}\n${modeReply}\n${question}\n${practice}`;
}

function analyzeText(text) {
  const includes = (...words) => words.some((word) => text.includes(word));
  if (includes("担心", "害怕", "焦虑", "变糟", "停不下来")) {
    return {
      theme: "fear",
      name: "恐惧",
      core: "你并不是只在害怕一件事，你是在和一个尚未发生的未来争论。",
      hiddenQuestion: "如果未来并不听命于你的担心，你还愿意把今天交给它吗？",
    };
  }
  if (includes("做不好", "没用", "失败", "不行", "沮丧")) {
    return {
      theme: "self",
      name: "自我审判",
      core: "你把一次经验升格成了对整个人的判决，这是痛苦最常见的诡计。",
      hiddenQuestion: "一个人是否必须表现良好，才配被温柔地对待？",
    };
  }
  if (includes("迷茫", "意义", "不知道", "想要什么", "空")) {
    return {
      theme: "meaning",
      name: "意义",
      core: "迷茫不是没有路，而是旧的答案已经不能继续替你生活。",
      hiddenQuestion: "如果没有人替你规定成功，你会选择成为什么样的人？",
    };
  }
  if (includes("压力", "累", "忙", "撑不住", "重要")) {
    return {
      theme: "burden",
      name: "重负",
      core: "压力往往不是事情太多，而是你把每一件事都解释成对自我价值的审判。",
      hiddenQuestion: "你是在完成任务，还是在试图证明自己值得存在？",
    };
  }
  return {
    theme: "unclear",
    name: "困惑",
    core: "真正的问题常常不会在第一句话里出现，它藏在你反复回避的那个词后面。",
    hiddenQuestion: "如果你不能再用习惯性的解释保护自己，剩下的事实是什么？",
  };
}

function getPhilosophicalOpening(profile) {
  const lines = {
    fear: `我听见的是“${state.mood}”，但更深处像是${profile.name}在要求你服从它。`,
    self: `你说的是“${state.mood}”，但语言背后有一种严厉的自我法庭。`,
    meaning: `你表面上在说“${state.mood}”，实质上是在追问生活是否仍然有方向。`,
    burden: `你称它为“${state.mood}”，可它更像一种把人压成工具的重负。`,
    unclear: `你的“${state.mood}”还没有完全成形，这恰好值得停下来凝视。`,
  };
  return lines[profile.theme] || lines.unclear;
}

function getReflection(profile) {
  if (profile.theme === "fear") {
    return `${profile.core} 斯多葛派会提醒你：痛苦的一半来自事件，另一半来自你对事件的预支。`;
  }
  if (profile.theme === "self") {
    return `${profile.core} 苏格拉底不会先安慰你，他会问：这个判决的证据是否足够严谨？`;
  }
  if (profile.theme === "meaning") {
    return `${profile.core} 存在主义的起点并不舒服：意义不是被发现的物品，而是由选择慢慢承担出来的。`;
  }
  if (profile.theme === "burden") {
    return `${profile.core} 一个清醒的人要学会区分责任与奴役，前者让人站直，后者让人失去自己。`;
  }
  return `${profile.core} 哲学不是给你一句漂亮的话，而是把模糊的痛苦变成可以面对的问题。`;
}

function getModeReply(profile) {
  if (state.mode === "斯多葛") {
    return `现在把它分成两列：我能控制的，和我不能控制的。你不能控制他人的看法、过去的事实、未来的全部结果；你能控制的是下一次判断、下一步行动、以及是否继续喂养这个念头。`;
  }
  if (state.mode === "存在主义") {
    return `不要急着问“怎样才不会痛苦”，先问“我愿意为了什么承受一点痛苦”。人的自由并不是想做什么就做什么，而是在没有完美答案时仍然选择，并为选择负责。`;
  }
  return `让我们用苏格拉底的方式慢慢逼近：你现在相信的那个结论，真的是事实，还是一个被情绪加热过的解释？${profile.hiddenQuestion}`;
}

function getQuestion(profile) {
  const questions = {
    fear: "请只回答一个问题：你最害怕发生的事，如果真的发生了，它会摧毁你的全部人生，还是只会摧毁你对掌控感的幻想？",
    self: "请问自己：如果一个你爱的人说出同样的话，你会用同样残酷的标准审判他吗？",
    meaning: "请问自己：你是真的没有方向，还是你已经知道方向，只是不愿意承受付出代价？",
    burden: "请问自己：这件事必须由你一个人背负吗，还是你把求助误解成了失败？",
    unclear: "请问自己：这段痛苦里，哪一句话是你最不愿意承认却最接近真实的？",
  };
  return questions[profile.theme] || questions.unclear;
}

function getPractice(profile) {
  if (profile.theme === "fear") {
    return "今天的练习：写下最坏结果、最可能结果、你能做的第一步。只写三行，不要写成灾难小说。";
  }
  if (profile.theme === "self") {
    return "今天的练习：把“我不行”改写成一个具体事实，例如“这次我没有准备好”。哲学从精确开始，自由也从精确开始。";
  }
  if (profile.theme === "meaning") {
    return "今天的练习：选一件很小但能代表你价值观的事去做。意义不是想出来的，它常常是在行动之后才回头显形。";
  }
  if (profile.theme === "burden") {
    return "今天的练习：删掉一个不必要的任务，或向一个具体的人提出一个具体请求。能分担的重负，不必被包装成坚强。";
  }
  return "今天的练习：把困惑写成一个问号结尾的问题。只要问题变清楚，痛苦就已经失去了一部分统治权。";
}
