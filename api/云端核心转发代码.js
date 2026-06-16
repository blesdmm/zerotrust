// ==========================================
// 1. Zero Trust 密钥资产配置
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isClash = searchParams.get('type') === 'clash';

    // ==========================================
    // 2. 【核心分流逻辑 1】如果是请求 Clash 规则订阅
    // ==========================================
    if (isClash) {
      // 2.1 从 Vercel 后台提取你配置的长串转换模板变量
      const templateUrl = process.env.CLASH_TEMPLATE_URL;
      
      if (!templateUrl) {
        return new Response("Error: Missing CLASH_TEMPLATE_URL environment variable in Vercel backend.", { status: 500 });
      }

      // 2.2 核心：让 Vercel 在后台替你请求远程转换 API，把套好规则的 YAML 抓回来
      const response = await fetch(templateUrl, {
        headers: {
          "User-Agent": "clash-verge/1.0.0" // 模拟客户端请求头，防止转换端拒绝
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        return new Response(`Remote Subconverter Error: ${errText}`, { status: response.status });
      }

      // 2.3 获取转换后的完整明文 YAML 规则配置
      const finalYamlConfig = await response.text();

      // 2.4 原封不动地直接吐给你的 Clash 客户端，并且强制彻底关掉边缘节点缓存（保证每次都随机）
      return new Response(finalYamlConfig, {
        headers: {
          "content-type": "text/yaml; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
    }

    // ==========================================
    // 3. 【核心分流逻辑 2】原本的旧逻辑，100% 吐出原汁原味小火箭 Base64 订阅
    // ==========================================
    let subnetsPool = ["162.159.193.5", "162.159.193.12"]; 
    let portsPool =; 

    if (process.env.SUBNETS) {
      const rawSubnets = process.env.SUBNETS.trim();
      if (rawSubnets.startsWith("[")) {
        try { subnetsPool = JSON.parse(rawSubnets); } catch (e) { }
      } else { subnetsPool = rawSubnets.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean); }
    }

    if (process.env.WG_PORTS) {
      const rawPorts = process.env.WG_PORTS.trim();
      if (rawPorts.startsWith("[")) {
        try { portsPool = JSON.parse(rawPorts).map(Number); } catch (e) { }
      } else { portsPool = rawPorts.split(/[\s,;\n]+/).map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p)); }
    }

    let finalIPs = [];
    for (const item of subnetsPool) {
      if (item.includes('/')) {
        const [base, mask] = item.split('/');
        if (mask === '24' && base.startsWith('162.159.193.')) {
          for (let i = 1; i <= 254; i++) { finalIPs.push(`162.159.193.${i}`); }
        } else { finalIPs.push(base); }
      } else { finalIPs.push(item); }
    }
    finalIPs = Array.from(new Set(finalIPs));

    const randomizedIPs = finalIPs.sort(() => Math.random() - 0.5);
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
    return new Response(`Runtime Error: ${err.message}`, { status: 200 });
  }
}

export const POST = GET;
