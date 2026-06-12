import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const STORAGE_KEY = "zxz_measure_app_v6";
const LEGACY_KEYS = ["zxz_measure_app_v5", "zxz_measure_app_v4", "zxz_measure_app_v3", "zxz_measure_app_v2", "zxz_measure_app_v1"];
const CLOUD_SYNCED_KEY = `${STORAGE_KEY}_cloud_synced_uid`;

const firebaseConfig = {
  apiKey: "AIzaSyC_0LeG-Y0ws04oJK2oNys4ZXbdXNpWueE",
  authDomain: "zhuangxiu-app.firebaseapp.com",
  projectId: "zhuangxiu-app",
  storageBucket: "zhuangxiu-app.firebasestorage.app",
  messagingSenderId: "95125920477",
  appId: "1:95125920477:web:10dfc4788a7599b4651934",
};

const defaultMaterialGroups = [
  {
    name: "瓷砖/石材",
    items: [
      { name: "客餐厨地面瓷砖", quantity: 68, unit: "片", price: "", amount: "", spec: "罗马利奥，750*1500瓷砖，柔光砖" },
      { name: "房间木地板", quantity: 39, unit: "m²", price: "", amount: "", spec: "圣象实木多层/新三层地板" },
      { name: "卫生间地/墙面瓷砖", quantity: 72, unit: "片", price: "", amount: "", spec: "罗马利奥，600*1200瓷砖，柔光砖" },
      { name: "阳台/厨房墙面瓷砖", quantity: 38, unit: "片", price: "", amount: "", spec: "罗马利奥，600*1200瓷砖，柔光砖" },
      { name: "厨房台面石英石", quantity: 7.5, unit: "米", price: "", amount: "", spec: "明盛石材，颜色任选" },
      { name: "阳台台面石英石", quantity: 2, unit: "米", price: "", amount: "", spec: "明盛石材，颜色任选" },
      { name: "美缝", quantity: 1, unit: "项", price: "", amount: "", spec: "" },
    ],
  },
  {
    name: "房门",
    items: [
      { name: "房间木门", quantity: 2, unit: "樘", price: "", amount: "", spec: "柜体同色" },
      { name: "入户房间木门", quantity: 1, unit: "樘", price: "", amount: "", spec: "隐形门" },
      { name: "入户门套", quantity: 5.8, unit: "米", price: "", amount: "", spec: "柜体同色" },
      { name: "卫生间门", quantity: 2, unit: "樘", price: "", amount: "", spec: "样多门业，极窄铝合金门" },
    ],
  },
  {
    name: "五金卫浴",
    items: [
      { name: "蹲坑", quantity: 1, unit: "套", price: "", amount: "", spec: "箭牌卫浴，套餐内" },
      { name: "马桶", quantity: 1, unit: "个", price: "", amount: "", spec: "箭牌卫浴，轻智能马桶" },
      { name: "公卫浴室柜", quantity: 1, unit: "米", price: "", amount: "", spec: "木作柜体，岩板台面定做/岩板台面+台盆水龙头" },
      { name: "主卫浴室柜", quantity: 1, unit: "米", price: "", amount: "", spec: "木作柜体，岩板台面定做/岩板台面+台盆水龙头" },
      { name: "花洒", quantity: 2, unit: "套", price: "", amount: "", spec: "箭牌卫浴，套餐内" },
      { name: "角阀", quantity: 12, unit: "个", price: "", amount: "", spec: "九牧，辉煌" },
      { name: "地漏", quantity: 3, unit: "个", price: "", amount: "", spec: "潜水艇，枪灰色" },
      { name: "主卫淋浴隔断", quantity: 1, unit: "套", price: "", amount: "", spec: "光头建材，极简型材" },
      { name: "阳台洗衣池", quantity: 1, unit: "套", price: "", amount: "", spec: "恒达卫浴" },
      { name: "厨房洗菜盆/龙头", quantity: 1, unit: "套", price: "", amount: "", spec: "诺米五金" },
    ],
  },
  {
    name: "灯具开关面板",
    items: [
      { name: "空气开关", quantity: 1, unit: "项", price: "", amount: "", spec: "公牛" },
      { name: "开关面板", quantity: 1, unit: "项", price: "", amount: "", spec: "公牛，西门子" },
      { name: "射灯", quantity: 38, unit: "个", price: "", amount: "", spec: "公牛" },
    ],
  },
];

const normalizeMaterialGroups = (groups = []) =>
  (Array.isArray(groups) ? groups : []).map((group) => ({
    name: group.name || "",
    items: (Array.isArray(group.items) ? group.items : []).map((item) => ({
      name: item.name || "",
      quantity: item.quantity ?? "",
      unit: item.unit || "",
      price: item.price ?? "",
      amount: item.amount ?? "",
      commission: item.commission ?? "",
      spec: item.spec || "",
    })),
  }));
const cloneDefaultMaterials = () => normalizeMaterialGroups(JSON.parse(JSON.stringify(defaultMaterialGroups)));
const $ = (id) => document.getElementById(id);
const money = (value) => `¥${Math.round(value || 0).toLocaleString("zh-CN")}`;
const preciseMoney = (value) => Number(value || 0).toFixed(2);
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

let state = loadState();
let activeCustomerId = state.activeCustomerId || state.customers[0]?.id || null;
let expandedCustomerId = null;
let cloudUser = null;
let cloudUnsubscribe = null;
let isApplyingCloudState = false;
let isSavingCloud = false;
let cloudReady = false;
let pendingCloudSave = false;

function loadState() {
  const saved = readStorage(STORAGE_KEY);
  if (saved) {
    try {
      return normalizeState(JSON.parse(saved), { fromLegacy: false });
    } catch {
      writeStorage(STORAGE_KEY, "");
    }
  }

  for (const legacyKey of LEGACY_KEYS) {
    const legacy = readStorage(legacyKey);
    if (!legacy) continue;
    try {
      return normalizeState(JSON.parse(legacy), { fromLegacy: true });
    } catch {
      writeStorage(legacyKey, "");
    }
  }

  return { activeCustomerId: null, customers: [] };
}

function normalizeState(raw, options = {}) {
  const fromLegacy = Boolean(options.fromLegacy);
  const sharedMaterials = raw.materialGroups?.length ? raw.materialGroups : null;
  const sourceCustomers = fromLegacy ? (raw.customers || []).filter(hasMeaningfulCustomerData) : raw.customers || [];
  const customers = sourceCustomers.map((customer, index) => ({
    id: customer.id || uid("customer"),
    name: customer.name || "",
    phone: customer.phone || "",
    address: customer.address || "",
    layout: customer.layout || "",
    area: Number(customer.area || 0),
    budget: Number(customer.budget || 0),
    style: customer.style || "",
    dealDate: customer.dealDate || "",
    status: customer.status || "待量房",
    needs: customer.needs || "",
    moduleName: customer.moduleName || (customer.name ? "" : `客户${index + 1}`),
    createdAt: customer.createdAt || new Date().toISOString(),
    updatedAt: customer.updatedAt || "",
    materialGroups: normalizeMaterialGroups(
      fromLegacy
        ? index === 0
          ? cloneDefaultMaterials()
          : []
        : Array.isArray(customer.materialGroups)
        ? customer.materialGroups
        : index === 0 && sharedMaterials
          ? sharedMaterials
          : index === 0
            ? cloneDefaultMaterials()
            : []
    ),
  }));

  return {
    activeCustomerId: customers.some((customer) => customer.id === raw.activeCustomerId) ? raw.activeCustomerId : customers[0]?.id || null,
    customers,
  };
}

function hasMeaningfulCustomerData(customer) {
  const name = String(customer.name || "").trim();
  const isPlaceholderName = /^新?客户\d+$/.test(name) || /^客户\d+$/.test(String(customer.moduleName || ""));
  return Boolean(
    (name && !isPlaceholderName) ||
      customer.phone ||
      customer.address ||
      customer.layout ||
      Number(customer.area || 0) > 0 ||
      Number(customer.budget || 0) > 0 ||
      customer.style ||
      customer.needs
  );
}

function saveState() {
  state.activeCustomerId = activeCustomerId;
  writeStorage(STORAGE_KEY, JSON.stringify(state));
  queueCloudSave();
}

function serializableState() {
  return normalizeState(JSON.parse(JSON.stringify(state || { activeCustomerId: null, customers: [] })), { fromLegacy: false });
}

function userDocRef(user = cloudUser) {
  return user ? doc(db, "users", user.uid, "appData", "main") : null;
}

function markCloudSynced(user) {
  writeStorage(CLOUD_SYNCED_KEY, user?.uid || "");
}

function hasSyncedCloudBefore(user) {
  return readStorage(CLOUD_SYNCED_KEY) === user?.uid;
}

function updateCloudStatus(message, options = {}) {
  const status = $("cloudStatus");
  const title = $("cloudTitle");
  const panel = $("cloudPanel");
  if (!status || !title || !panel) return;
  status.textContent = message;
  title.textContent = options.title || (cloudUser ? "已连接云端" : "登录云端账号");
  panel.classList.toggle("cloud-online", Boolean(cloudUser));
  panel.classList.toggle("cloud-error", Boolean(options.error));
}

function queueCloudSave() {
  if (!cloudUser || !cloudReady || isApplyingCloudState) return;
  pendingCloudSave = true;
  window.clearTimeout(queueCloudSave.timer);
  queueCloudSave.timer = window.setTimeout(saveCloudState, 650);
}

async function saveCloudState() {
  if (!cloudUser || !cloudReady || isApplyingCloudState || isSavingCloud) return;
  pendingCloudSave = false;
  isSavingCloud = true;
  try {
    await setDoc(
      userDocRef(),
      {
        state: serializableState(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    updateCloudStatus(`已登录：${cloudUser.email || "云端账号"}，资料已保存到云端。`);
  } catch (error) {
    updateCloudStatus(`云端保存失败：${friendlyFirebaseError(error)}`, { error: true });
  } finally {
    isSavingCloud = false;
    if (pendingCloudSave) {
      queueCloudSave();
    }
  }
}

async function loadCloudState(user) {
  cloudReady = false;
  updateCloudStatus("正在读取云端资料...");
  const localState = serializableState();
  const hasLocalData = localState.customers.length > 0;

  try {
    const ref = userDocRef(user);
    const snapshot = await getDoc(ref);
    const cloudState = snapshot.exists() ? snapshot.data()?.state : null;

    if (hasLocalData && !hasSyncedCloudBefore(user)) {
      await setDoc(
        ref,
        {
          state: localState,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      markCloudSynced(user);
      updateCloudStatus(`已登录：${user.email || "云端账号"}，已把本机旧资料上传到云端。`);
    } else if (cloudState?.customers?.length) {
      applyState(cloudState);
      markCloudSynced(user);
      updateCloudStatus(`已登录：${user.email || "云端账号"}，已读取云端资料。`);
    } else if (hasLocalData) {
      await setDoc(
        ref,
        {
          state: localState,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      markCloudSynced(user);
      updateCloudStatus(`已登录：${user.email || "云端账号"}，已把本机资料保存到云端。`);
    } else {
      markCloudSynced(user);
      updateCloudStatus(`已登录：${user.email || "云端账号"}，云端暂无客户资料。`);
    }

    cloudReady = true;
    subscribeCloudState(user);
  } catch (error) {
    cloudReady = false;
    updateCloudStatus(`云端读取失败：${friendlyFirebaseError(error)}`, { error: true });
  }
}

function applyState(nextState) {
  isApplyingCloudState = true;
  state = normalizeState(nextState || {}, { fromLegacy: false });
  activeCustomerId = state.activeCustomerId || state.customers[0]?.id || null;
  expandedCustomerId = activeCustomerId;
  writeStorage(STORAGE_KEY, JSON.stringify(state));
  fillCustomerForm(activeCustomer());
  renderAll();
  isApplyingCloudState = false;
}

function subscribeCloudState(user) {
  cloudUnsubscribe?.();
  cloudUnsubscribe = onSnapshot(
    userDocRef(user),
    (snapshot) => {
      if (!cloudReady || isSavingCloud) return;
      const cloudState = snapshot.data()?.state;
      if (!cloudState) return;
      const localJson = JSON.stringify(serializableState());
      const cloudJson = JSON.stringify(normalizeState(cloudState, { fromLegacy: false }));
      if (localJson === cloudJson) return;
      applyState(cloudState);
      updateCloudStatus(`已登录：${user.email || "云端账号"}，已同步云端最新资料。`);
    },
    (error) => {
      updateCloudStatus(`云端同步中断：${friendlyFirebaseError(error)}`, { error: true });
    }
  );
}

function friendlyFirebaseError(error) {
  const code = error?.code || "";
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) return "邮箱或密码不正确";
  if (code.includes("auth/user-not-found")) return "这个邮箱还没有添加用户";
  if (code.includes("permission-denied")) return "数据库权限未打开";
  if (code.includes("unavailable")) return "网络暂时不可用";
  return error?.message || "请稍后重试";
}

function readStorage(key) {
  try {
    return window.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(key, value) {
  try {
    if (value) {
      window.localStorage?.setItem(key, value);
    } else {
      window.localStorage?.removeItem(key);
    }
  } catch {
    // The app still works without browser storage; data just will not persist.
  }
}

function activeCustomer() {
  return state.customers.find((customer) => customer.id === activeCustomerId) || null;
}

function activeMaterials() {
  return activeCustomer()?.materialGroups || [];
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeBlankCustomer() {
  const count = state.customers.length + 1;
  const isFirstCustomer = state.customers.length === 0;
  return {
    id: uid("customer"),
    name: "",
    phone: "",
    address: "",
    layout: "",
    area: 0,
    budget: 0,
    style: "",
    dealDate: "",
    status: "待量房",
    needs: "",
    moduleName: `客户${count}`,
    createdAt: new Date().toISOString(),
    updatedAt: "",
    materialGroups: isFirstCustomer ? cloneDefaultMaterials() : [],
  };
}

function ensureActiveCustomer() {
  let customer = activeCustomer();
  if (customer) return customer;
  customer = makeBlankCustomer();
  state.customers.push(customer);
  activeCustomerId = customer.id;
  expandedCustomerId = customer.id;
  saveState();
  return customer;
}

function readCustomerForm() {
  return {
    name: $("customerName").value.trim(),
    phone: $("customerPhone").value.trim(),
    address: $("customerAddress").value.trim(),
    layout: $("customerLayout").value.trim(),
    area: Number($("customerArea").value || 0),
    budget: Number($("customerBudget").value || 0),
    style: $("customerStyle").value.trim(),
    dealDate: $("customerDealDate").value,
    status: $("customerStatus").value,
    needs: $("customerNeeds").value.trim(),
  };
}

function fillCustomerForm(customer) {
  $("customerName").value = customer?.name || "";
  $("customerPhone").value = customer?.phone || "";
  $("customerAddress").value = customer?.address || "";
  $("customerLayout").value = customer?.layout || "";
  $("customerArea").value = customer?.area || "";
  $("customerBudget").value = customer?.budget || "";
  $("customerStyle").value = customer?.style || "";
  $("customerDealDate").value = customer?.dealDate || "";
  $("customerStatus").value = customer?.status || "待量房";
  $("customerNeeds").value = customer?.needs || "";
}

function materialAmount(item) {
  if (item.amount !== "" && item.amount !== undefined && item.amount !== null) {
    return Number(item.amount || 0);
  }
  return Number(item.quantity || 0) * Number(item.price || 0);
}

function groupTotal(group) {
  return group.items.reduce((sum, item) => sum + materialAmount(item), 0);
}

function itemCommission(item) {
  return item.commission === "" || item.commission === undefined || item.commission === null ? 0 : Number(item.commission || 0);
}

function groupCommissionTotal(group) {
  return group.items.reduce((sum, item) => sum + itemCommission(item), 0);
}

function materialGrandTotal() {
  return activeMaterials().reduce((sum, group) => sum + groupTotal(group), 0);
}

function commissionGrandTotal() {
  return activeMaterials().reduce((sum, group) => sum + groupCommissionTotal(group), 0);
}

function materialItemCount() {
  return activeMaterials().reduce((sum, group) => sum + group.items.length, 0);
}

function materialPricingStats() {
  const items = activeMaterials().flatMap((group) => group.items);
  const filled = items.filter((item) => {
    const hasAmount = item.amount !== "" && item.amount !== undefined && item.amount !== null;
    const hasPrice = item.price !== "" && item.price !== undefined && item.price !== null;
    return hasAmount || hasPrice;
  }).length;
  return {
    filled,
    pending: Math.max(items.length - filled, 0),
    total: items.length,
  };
}

function renderAll() {
  renderCustomerModules();
  renderMaterials();
  renderQuote();
  renderReport();
  renderDashboard();
  const customer = activeCustomer();
  $("customerCount").textContent = state.customers.length;
  $("materialCount").textContent = materialItemCount();
  $("quoteTotal").textContent = money(materialGrandTotal());
  $("activeCustomerTitle").textContent = customer ? `${customerDisplayName(customer)}的模块` : "请新增客户";
}

function renderDashboard() {
  const customer = activeCustomer();
  const budget = Number(customer?.budget || 0);
  const total = materialGrandTotal();
  const stats = materialPricingStats();
  const maxValue = Math.max(budget, total, 1);
  const budgetHeight = Math.max(8, Math.round((budget / maxValue) * 100));
  const quoteHeight = Math.max(8, Math.round((total / maxValue) * 100));
  const completion = stats.total ? Math.round((stats.filled / stats.total) * 100) : 0;

  $("activeBudget").textContent = money(budget);
  $("activeNeedPreview").textContent = customer?.needs || `${customerDisplayName(customer)}暂无装修备注`;
  $("budgetBar").style.height = `${budgetHeight}%`;
  $("quoteBar").style.height = `${quoteHeight}%`;
  $("budgetDelta").textContent = total > budget ? `超预算 ${money(total - budget)}` : `剩余 ${money(budget - total)}`;
  $("completionDonut").style.setProperty("--complete", `${completion}%`);
  $("completionPercent").textContent = `${completion}%`;
  $("statusChip").textContent = customer?.status || "待量房";
  $("filledPriceCount").textContent = stats.filled;
  $("pendingPriceCount").textContent = stats.pending;
  renderCategoryChart();
}

function renderCategoryChart() {
  const chart = $("categoryChart");
  const groups = activeMaterials();
  chart.innerHTML = "";
  if (!groups.length) {
    chart.innerHTML = `<div class="chart-empty">暂无主材分类</div>`;
    return;
  }

  const maxTotal = Math.max(...groups.map(groupTotal), 1);
  groups.forEach((group) => {
    const total = groupTotal(group);
    const percent = Math.round((total / maxTotal) * 100);
    const row = document.createElement("div");
    row.className = "category-chart-row";
    row.innerHTML = `
      <span>${escapeHtml(group.name || "未命名分类")}</span>
      <div><i style="width: ${percent}%"></i></div>
      <strong>${money(total)}</strong>
    `;
    chart.appendChild(row);
  });
}

function renderCustomerModules() {
  const list = $("customerList");
  list.innerHTML = "";
  if (!state.customers.length) {
    list.appendChild($("emptyTemplate").content.cloneNode(true));
    return;
  }

  state.customers.forEach((customer, index) => {
    const card = document.createElement("article");
    const isActive = customer.id === activeCustomerId;
    const isExpanded = customer.id === expandedCustomerId;
    card.className = `customer-accordion-card${isActive ? " active" : ""}${isExpanded ? " expanded" : ""}`;
    card.innerHTML = `
      <button class="customer-accordion-head" data-action="toggle-customer" data-id="${customer.id}">
        <span class="customer-index">客户${index + 1}</span>
        <span class="customer-brief">
          <strong>${escapeHtml(customerDisplayName(customer))}</strong>
          <small>${escapeHtml(customer.status || "待量房")} · 成交：${escapeHtml(formatDealDate(customer.dealDate))} · ${money(customerTotal(customer))}</small>
        </span>
        <span class="customer-toggle">${isExpanded ? "收起" : "展开"}</span>
      </button>
      ${
        isExpanded
          ? `<div class="customer-accordion-body">
              <div class="customer-detail-grid">
                <span>电话：${escapeHtml(customer.phone || "未填")}</span>
                <span>地址：${escapeHtml(customer.address || "未填")}</span>
                <span>面积：${escapeHtml(formatCustomerArea(customer))}</span>
                <span>预算：${money(customer.budget || 0)}</span>
                <span>成交日期：${escapeHtml(formatDealDate(customer.dealDate))}</span>
              </div>
              <div class="customer-accordion-actions">
                <button class="secondary-button compact-button" data-action="view-customers" data-id="${customer.id}">客户档案</button>
                <button class="secondary-button compact-button" data-action="view-measure" data-id="${customer.id}">主材清单</button>
                <button class="secondary-button compact-button" data-action="view-quote" data-id="${customer.id}">预算看板</button>
                <button class="customer-accordion-delete" data-action="delete" data-id="${customer.id}" title="删除客户">删除</button>
              </div>
            </div>`
          : ""
      }
    `;
    list.appendChild(card);
  });
}

function customerTotal(customer) {
  return (customer.materialGroups || []).reduce((sum, group) => sum + groupTotal(group), 0);
}

function formatCustomerArea(customer) {
  return Number(customer?.area || 0) > 0 ? `${customer.area}m²` : "未填面积";
}

function formatDealDate(value) {
  if (!value) return "未填";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${year}/${month}/${day}`;
}

function customerDisplayName(customer) {
  if (customer?.name) return customer.name;
  const index = state.customers.findIndex((item) => item.id === customer?.id);
  return index >= 0 ? `客户${index + 1}` : customer?.moduleName || "未命名客户";
}

function renderMaterials() {
  const customer = activeCustomer();
  $("sheetOwner").textContent = customer?.name || "未选择";
  $("sheetPhone").textContent = customer?.phone || "未填";
  $("sheetAddress").textContent = customer?.address || "未填";
  $("sheetArea").textContent = `${customer?.area || 0} m²`;
  $("sheetDealDate").textContent = formatDealDate(customer?.dealDate);
  $("materialGrandTotal").textContent = money(materialGrandTotal());
  $("commissionGrandTotal").textContent = money(commissionGrandTotal());

  const body = $("materialTableBody");
  body.innerHTML = "";
  if (!customer) {
    body.innerHTML = `<tr><td colspan="9" class="sheet-empty-cell">请先新增客户，再填写这个客户的主材表。</td></tr>`;
    return;
  }

  if (!activeMaterials().length) {
    body.innerHTML = `<tr><td colspan="9" class="sheet-empty-cell">这个客户是空白清单，点击“添加项目”开始填写。</td></tr>`;
    return;
  }

  activeMaterials().forEach((group, groupIndex) => {
    const categoryRow = document.createElement("tr");
    categoryRow.className = "category-row";
    categoryRow.innerHTML = `
      <td colspan="9">
        <input class="category-input" value="${escapeHtml(group.name)}" data-group="${groupIndex}" data-field="category">
      </td>
    `;
    body.appendChild(categoryRow);

    group.items.forEach((item, itemIndex) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="serial">${itemIndex + 1}</td>
        <td><input value="${escapeHtml(item.name)}" data-group="${groupIndex}" data-item="${itemIndex}" data-field="name"></td>
        <td><input type="number" min="0" step="0.01" value="${inputNumberValue(item.quantity)}" data-group="${groupIndex}" data-item="${itemIndex}" data-field="quantity"></td>
        <td><input value="${escapeHtml(item.unit)}" data-group="${groupIndex}" data-item="${itemIndex}" data-field="unit"></td>
        <td><input type="number" min="0" step="0.01" value="${inputNumberValue(item.price)}" data-group="${groupIndex}" data-item="${itemIndex}" data-field="price"></td>
        <td><input class="amount-input" type="number" min="0" step="0.01" value="${inputAmountValue(item)}" data-group="${groupIndex}" data-item="${itemIndex}" data-field="amount"></td>
        <td><input class="commission-input" type="number" min="0" step="0.01" value="${inputNumberValue(item.commission)}" data-group="${groupIndex}" data-item="${itemIndex}" data-field="commission"></td>
        <td><textarea rows="1" data-group="${groupIndex}" data-item="${itemIndex}" data-field="spec">${escapeHtml(item.spec)}</textarea></td>
        <td><button class="row-delete-button" data-action="delete-item" data-group="${groupIndex}" data-item="${itemIndex}">删除</button></td>
      `;
      body.appendChild(row);
    });

    const totalRow = document.createElement("tr");
    totalRow.className = "sheet-total-row";
    totalRow.innerHTML = `
      <td></td>
      <td colspan="4">合计</td>
      <td>${preciseMoney(groupTotal(group))}</td>
      <td>${preciseMoney(groupCommissionTotal(group))}</td>
      <td colspan="2"></td>
    `;
    body.appendChild(totalRow);
  });
}

function renderQuote() {
  const summary = $("categorySummary");
  const wrap = $("quoteItems");
  summary.innerHTML = "";
  wrap.innerHTML = "";

  if (!activeCustomer()) {
    summary.innerHTML = `<div class="empty-state">请先新增客户。</div>`;
    $("quoteTotalLarge").textContent = money(0);
    return;
  }

  if (!activeMaterials().length) {
    summary.innerHTML = `<div class="empty-state">当前客户还没有主材项目。</div>`;
    wrap.innerHTML = `<div class="empty-state">请先到“量房”里添加项目。</div>`;
    $("quoteTotalLarge").textContent = money(0);
    return;
  }

  activeMaterials().forEach((group) => {
    const item = document.createElement("div");
    item.innerHTML = `<span>${escapeHtml(group.name)}</span><strong>${money(groupTotal(group))}</strong>`;
    summary.appendChild(item);
  });

  activeMaterials().forEach((group) => {
    const groupBlock = document.createElement("div");
    groupBlock.className = "quote-group";
    const rows = group.items
      .map(
        (item) => `
          <div class="quote-line">
            <span>${escapeHtml(item.name || "未命名项目")}</span>
            <small>${formatQuantity(item.quantity)} ${escapeHtml(item.unit || "")} x ${formatPrice(item.price)} · 提成 ${formatCommission(item.commission)}</small>
            <strong>${money(materialAmount(item))}</strong>
          </div>
        `
      )
      .join("");
    groupBlock.innerHTML = `
      <div class="quote-group-title">
        <strong>${escapeHtml(group.name)}</strong>
        <span>${money(groupTotal(group))}</span>
      </div>
      ${rows}
    `;
    wrap.appendChild(groupBlock);
  });
  $("quoteTotalLarge").textContent = money(materialGrandTotal());
}

function renderReport() {
  const customer = activeCustomer();
  const content = $("reportContent");

  if (!customer) {
    content.innerHTML = `<div class="empty-state">请先新增客户。</div>`;
    return;
  }

  const materialRows = activeMaterials()
    .map((group) => {
      const rows = group.items
        .map(
          (item, index) => `<tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.name)}</td>
            <td>${formatQuantity(item.quantity)}</td>
            <td>${escapeHtml(item.unit)}</td>
            <td>${formatPlainPrice(item.price)}</td>
            <td>${formatPlainAmount(item)}</td>
            <td>${formatPlainCommission(item.commission)}</td>
            <td>${escapeHtml(item.spec || "")}</td>
          </tr>`
        )
        .join("");

      return `
        <tr class="report-category"><td colspan="8">${escapeHtml(group.name)}</td></tr>
        ${rows}
        <tr class="report-total"><td></td><td colspan="4">合计</td><td>${preciseMoney(groupTotal(group))}</td><td>${preciseMoney(groupCommissionTotal(group))}</td><td></td></tr>
      `;
    })
    .join("");

  content.innerHTML = `
    <div class="paper-report">
      <h2>主材项目清单</h2>
      <div class="paper-meta">
        <span>业主：${escapeHtml(customer.name || "")}</span>
        <span>电话：${escapeHtml(customer.phone || "")}</span>
        <span>地址：${escapeHtml(customer.address || "")}</span>
        <span>建筑面积：${customer.area || 0}m²</span>
        <span>成交日期：${escapeHtml(formatDealDate(customer.dealDate))}</span>
      </div>
      <table class="report-table material-report-table">
        <thead>
          <tr><th>序号</th><th>主材项目</th><th>数量</th><th>单位</th><th>单价</th><th>总价</th><th>提成</th><th>规格说明</th></tr>
        </thead>
        <tbody>${materialRows}</tbody>
      </table>
      <div class="quote-footer"><span>总计</span><strong>${money(materialGrandTotal())}</strong></div>
      <div class="quote-footer commission-footer"><span>提成合计</span><strong>${money(commissionGrandTotal())}</strong></div>
      <p class="hint">此清单为销售现场主材初步估算，最终以设计方案和公司正式报价为准。</p>
    </div>
  `;
}

function updateMaterialField(target) {
  const customer = activeCustomer();
  if (!customer) return;

  const groupIndex = Number(target.dataset.group);
  const itemIndex = Number(target.dataset.item);
  const field = target.dataset.field;
  if (Number.isNaN(groupIndex) || !field) return;

  if (field === "category") {
    customer.materialGroups[groupIndex].name = target.value;
    return;
  }

  const item = customer.materialGroups[groupIndex]?.items[itemIndex];
  if (!item) return;
  item[field] =
    field === "quantity" || field === "price" || field === "amount" || field === "commission" ? parseEditableNumber(target.value) : target.value;
}

function parseEditableNumber(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? "" : Number(trimmed);
}

function inputNumberValue(value) {
  return value === "" || value === undefined || value === null ? "" : value;
}

function inputAmountValue(item) {
  if (item.amount !== "" && item.amount !== undefined && item.amount !== null) return item.amount;
  if (item.price === "" || item.price === undefined || item.price === null) return "";
  return preciseMoney(materialAmount(item));
}

function formatQuantity(value) {
  return value === "" || value === undefined || value === null ? "" : Number(value || 0).toString();
}

function formatPrice(value) {
  return value === "" || value === undefined || value === null ? "未填单价" : money(value);
}

function formatCommission(value) {
  return value === "" || value === undefined || value === null ? "未填" : money(value);
}

function formatPlainPrice(value) {
  return value === "" || value === undefined || value === null ? "" : preciseMoney(value);
}

function formatPlainCommission(value) {
  return value === "" || value === undefined || value === null ? "" : preciseMoney(value);
}

function formatPlainAmount(item) {
  const hasAmount = item.amount !== "" && item.amount !== undefined && item.amount !== null;
  const hasPrice = item.price !== "" && item.price !== undefined && item.price !== null;
  return hasAmount || hasPrice ? preciseMoney(materialAmount(item)) : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function switchView(view) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  $(`${view}View`).classList.add("active");
  if (view === "report") renderReport();
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

$("customerForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = readCustomerForm();
  const current = activeCustomer() || makeBlankCustomer();

  Object.assign(current, form, { updatedAt: new Date().toISOString() });
  if (!state.customers.some((customer) => customer.id === current.id)) {
    state.customers.push(current);
  }
  activeCustomerId = current.id;
  expandedCustomerId = current.id;
  saveState();
  renderAll();
});

$("newCustomerBtn").addEventListener("click", () => {
  const customer = makeBlankCustomer();
  state.customers.push(customer);
  activeCustomerId = customer.id;
  expandedCustomerId = customer.id;
  fillCustomerForm(customer);
  switchView("customers");
  saveState();
  renderAll();
});

$("customerList").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (action === "toggle-customer") {
    activeCustomerId = id;
    expandedCustomerId = expandedCustomerId === id ? null : id;
    fillCustomerForm(activeCustomer());
  }
  if (action?.startsWith("view-")) {
    activeCustomerId = id;
    expandedCustomerId = id;
    fillCustomerForm(activeCustomer());
    switchView(action.replace("view-", ""));
  }
  if (action === "delete") {
    state.customers = state.customers.filter((customer) => customer.id !== id);
    activeCustomerId = state.customers[0]?.id || null;
    expandedCustomerId = null;
    fillCustomerForm(activeCustomer());
  }
  saveState();
  renderAll();
});

$("materialTableBody").addEventListener("change", (event) => {
  updateMaterialField(event.target);
  saveState();
  renderAll();
});

$("materialTableBody").addEventListener("input", (event) => {
  updateMaterialField(event.target);
  saveState();
  if (event.target.dataset.field === "commission") {
    $("commissionGrandTotal").textContent = money(commissionGrandTotal());
  }
});

$("materialTableBody").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='delete-item']");
  if (!button) return;
  const customer = activeCustomer();
  if (!customer) return;
  const groupIndex = Number(button.dataset.group);
  const itemIndex = Number(button.dataset.item);
  customer.materialGroups[groupIndex]?.items.splice(itemIndex, 1);
  saveState();
  renderAll();
});

$("addMaterialBtn").addEventListener("click", () => {
  const customer = ensureActiveCustomer();
  const lastGroup = customer.materialGroups[customer.materialGroups.length - 1] || { name: "新增分类", items: [] };
  if (!customer.materialGroups.length) customer.materialGroups.push(lastGroup);
  lastGroup.items.push({ name: "新增项目", quantity: 1, unit: "项", price: "", amount: "", commission: "", spec: "" });
  saveState();
  renderAll();
});

$("addCategoryBtn").addEventListener("click", () => {
  const customer = ensureActiveCustomer();
  customer.materialGroups.push({
    name: "新增分类",
    items: [{ name: "新增项目", quantity: 1, unit: "项", price: "", amount: "", commission: "", spec: "" }],
  });
  saveState();
  renderAll();
});

$("resetMaterialsBtn").addEventListener("click", () => {
  const customer = ensureActiveCustomer();
  if (!confirm("确定恢复当前客户的主材清单模板？当前修改的项目会被覆盖。")) return;
  customer.materialGroups = cloneDefaultMaterials();
  saveState();
  renderAll();
});

$("saveQuoteBtn").addEventListener("click", () => {
  saveState();
  renderAll();
});

$("recalcBtn").addEventListener("click", renderAll);
$("printReportBtn").addEventListener("click", () => {
  switchView("report");
  window.print();
});
$("reportPrintBtn").addEventListener("click", () => window.print());

onAuthStateChanged(auth, (user) => {
  cloudUser = user;
  cloudReady = false;
  cloudUnsubscribe?.();
  cloudUnsubscribe = null;

  $("cloudLoginForm").hidden = Boolean(user);
  $("cloudLogoutBtn").hidden = !user;

  if (user) {
    loadCloudState(user);
  } else {
    updateCloudStatus("未登录：当前资料只保存在这台设备。");
  }
});

$("cloudLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("cloudEmail").value.trim();
  const password = $("cloudPassword").value;
  if (!email || !password) return;

  updateCloudStatus("正在登录云端账号...");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    $("cloudPassword").value = "";
  } catch (error) {
    updateCloudStatus(`登录失败：${friendlyFirebaseError(error)}`, { error: true });
  }
});

$("cloudLogoutBtn").addEventListener("click", async () => {
  await signOut(auth);
});

fillCustomerForm(activeCustomer());
renderAll();
