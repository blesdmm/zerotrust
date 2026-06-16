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
    // ==========================================
    // 2. 超强容错的文本解析（支持不加括号、直接逗号或换行）
    // ==========================================
    let subnetsPool = ["162.159.193.5", "162.159.193.12"]; // 默认兜底
    let portsPool = [2408, 500, 1701, 4500];             // 默认兜底

    // 2.1 解析自定义 IP / 网段
    if (process.env.SUBNETS) {
      const rawSubnets = process.env.SUBNETS.trim();
      if (rawSubnets.startsWith("[")) {
        try { subnetsPool = JSON.parse(rawSubnets); } catch (e) { }
      } else {
        // 用正则切分：不管你用逗号、分号、换行还是空格分隔，都能切开
        subnetsPool = rawSubnets.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
      }
    }

    // 2.2 解析自定义端口
    if (process.env.WG_PORTS) {
      const rawPorts = process.env.WG_PORTS.trim();
      if (rawPorts.startsWith("[")) {
        try { portsPool = JSON.parse(rawPorts).map(Number); } catch (e) { }
      } else {
        portsPool = rawPorts.split(/[\s,;\n]+/).map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
      }
    }

    // ==========================================
    // 3. 智能生成并随机打乱 IP 列表
    // ==========================================
    let finalIPs = [];

    for (const item of subnetsPool) {
      // 核心适配：如果你在变量里不加括号输入了 "162.159.193.0/24"
      if (item.includes('/')) {
        const [base, mask] = item.split('/');
        if (mask === '24' && base.startsWith('162.159.193.')) {
          // 直接生成 Teams 193 网段的全部 254 个有效 IP
          for (let i = 1; i <= 254; i++) {
            finalIPs.push(`162.159.193.${i}`);
          }
        } else {
          // 如果是其他网段前缀，保留原样
          finalIPs.push(base);
        }
      } else {
        // 如果是纯单个 IP (如 162.159.193.5)，直接塞入
        finalIPs.push(item);
      }
    }

    // 数组去重
    finalIPs = Array.from(new Set(finalIPs));

    if (finalIPs.length === 0) {
      return new Response("Error: No valid IPs found in SUBNETS variable.", { status: 400 });
    }

    // 【关键】对最终提取出来的 IP 范围进行彻底的随机洗牌打乱
    const randomizedIPs = finalIPs.sort(() => Math.random() - 0.5);
    let proxyConfigs = [];

    // ==========================================
    // 4. 组装订阅配置
    // ==========================================
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
    // 即使发生未知错误也绝不丢出 500 页面，而是以纯文本形式把报错打印在网页上，方便你排查
    return new Response(`Runtime Error: ${err.message}`, { status: 200 });
  }
}

// 兜底支持 POST
export const POST = GET;
