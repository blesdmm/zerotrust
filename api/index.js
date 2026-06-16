// ==========================================
// 1. Zero Trust 密钥资产配置（按需修改）
// ==========================================
const TEAM_ACCOUNTS = [
  {
    name: "WARP-A",
    private_key: "n43X5B3CQSEOYaDwAq+6/nRIsdK0SthZbEYtHWPh9Zs=", 
    local_address: "100.96.0.29/32,2606:4700:cf1:1000::3/128",     
    public_key: "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=",    
    reserved_str: "229,201,47",
    mtu: 1280
  },
  {
    name: "WARP-B",
    private_key: "d3F4nbMk+c/4PMWURhXGGrWS9rsGNhIPh1WyWSJnBYc=", 
    local_address: "100.96.0.32/32,2606:4700:cf1:1000::6/128",     
    public_key: "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=",    
    reserved_str: "11,57,110",
    mtu: 1208
  }
];

// ==========================================
// 2. 统一的变量解析核心逻辑
// ==========================================
function parseConfig() {
  let subnetsPool = ["162.159.193.5", "162.159.193.12"]; // 默认兜底
  let portsPool =; // 默认兜底

  if (process.env.SUBNETS) {
    const rawSubnets = process.env.SUBNETS.trim();
    if (rawSubnets.startsWith("[")) {
      try { subnetsPool = JSON.parse(rawSubnets); } catch (e) { }
    } else {
      subnetsPool = rawSubnets.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
    }
  }

  if (process.env.WG_PORTS) {
    const rawPorts = process.env.WG_PORTS.trim();
    if (rawPorts.startsWith("[")) {
      try { portsPool = JSON.parse(rawPorts).map(Number); } catch (e) { }
    } else {
      portsPool = rawPorts.split(/[\s,;\n]+/).map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
    }
  }

  return { subnetsPool, portsPool };
}

// ==========================================
// 3. 处理核心路由（支持 GET / POST 分流）
// ==========================================
export async function GET(request) {
  try {
    const { subnetsPool, portsPool } = parseConfig();

    // 随机打乱你输入的 IP 列表
    const randomizedIPs = [...subnetsPool].sort(() => Math.random() - 0.5);
    let proxyConfigs = [];

    for (let i = 0; i < randomizedIPs.length; i++) {
      const account = TEAM_ACCOUNTS[i % TEAM_ACCOUNTS.length];
      const endIp = randomizedIPs[i]; 
      const endPort = portsPool[Math.floor(Math.random() * portsPool.length)];

      const safePrivateKey = encodeURIComponent(account.private_key);
      const safePublicKey = encodeURIComponent(account.public_key);
      const safeAddress = encodeURIComponent(account.local_address);
      const safeReserved = encodeURIComponent(account.reserved_str);
      
      const randomID = Math.floor(1000 + Math.random() * 9000);
      const nodeName = encodeURIComponent(`⚡ZT-${account.name}-P${endPort}-${i+1}-[${randomID}]`);

      const wgLink = `wireguard://${safePrivateKey}@${endIp}:${endPort}?address=${safeAddress}&reserved=${safeReserved}&publickey=${safePublicKey}&mtu=${account.mtu}#${nodeName}`;
      proxyConfigs.push(wgLink);
    }

    if (proxyConfigs.length === 0) {
      return new Response("No valid IP addresses.", { status: 400 });
    }

    const subscriptionContent = proxyConfigs.join("\n");
    const base64Response = btoa(unescape(encodeURIComponent(subscriptionContent)));

    return new Response(base64Response, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
  } catch (err) {
    return new Response(`GET Error: ${err.message}`, { status: 500 });
  }
}

// 专门接收本地自动化推送的接口
export async function POST(request) {
  try {
    const body = await request.json();
    const { secret, ips } = body;
    
    if (!secret || secret !== process.env.UPDATE_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!process.env.VERCEL_PROJECT_ID || !process.env.SUBNETS_ENV_ID || !process.env.VERCEL_AUTH_TOKEN) {
      return new Response("Missing Vercel API configuration env variables", { status: 500 });
    }

    const res = await fetch(`https://vercel.com{process.env.VERCEL_PROJECT_ID}/env/${process.env.SUBNETS_ENV_ID}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${process.env.VERCEL_AUTH_TOKEN}` },
      body: JSON.stringify({ value: JSON.stringify(ips) })
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(`Vercel API Error: ${errText}`, { status: res.status });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(`POST Error: ${e.message}`, { status: 500 });
  }
}
