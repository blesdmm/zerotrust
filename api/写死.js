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
    // 2. 超强容错与防崩溃兜底（系统吞字完美修复）
    // ==========================================
    let subnetsPool = ["162.159.193.5", "162.159.193.12"]; // 变量未生效时的活IP兜底
    const defaultPortsStr = "2408,500,1701,4500";
    let portsPool = defaultPortsStr.split(",").map(Number); // 变量未生效时的端口兜底

    // 2.1 尝试读取并激活你设置的 IP 变量
    if (process.env.SUBNETS && process.env.SUBNETS.trim() !== "") {
      const rawSubnets = process.env.SUBNETS.trim();
      if (rawSubnets.startsWith("[")) {
        try { subnetsPool = JSON.parse(rawSubnets); } catch (e) { }
      } else {
        // 支持不加括号，直接逗号、换行或空格分隔
        subnetsPool = rawSubnets.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
      }
    }

    // 2.2 尝试读取并激活你设置的端口变量
    if (process.env.WG_PORTS && process.env.WG_PORTS.trim() !== "") {
      const rawPorts = process.env.WG_PORTS.trim();
      if (rawPorts.startsWith("[")) {
        try { portsPool = JSON.parse(rawPorts).map(Number); } catch (e) { }
      } else {
        portsPool = rawPorts.split(/[\s,;\n]+/).map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
      }
    }

    // ==========================================
    // 3. 智能网段展开与高并发随机洗牌打乱
    // ==========================================
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
    
    if (finalIPs.length === 0 || portsPool.length === 0) {
      return new Response("Error: Config configuration is empty.", { status: 400 });
    }

    // 核心：彻底打乱你指定的 IP 范围顺序
    const randomizedIPs = finalIPs.sort(() => Math.random() - 0.5);

    // ==========================================
    // 4. 【分支一：Clash 外壳注入流】
    // ==========================================
    if (isClash) {
      const templateBaseUrl = process.env.CLASH_TEMPLATE_URL;
      // 即使不填变量，这里也硬编码了你的长规则外壳做兜底，绝对不崩溃
      const finalTemplateUrl = templateBaseUrl || "https://vercel.app[%22Ad%20Block%22,%22AI%20Services%22,%22Bilibili%22,%22Youtube%22,%22Google%22,%22Private%22,%22Location:CN%22,%22Telegram%22,%22Github%22,%22Microsoft%22,%22Apple%22,%22Social%20Media%22,%22Streaming%22,%22Gaming%22,%22Education%22,%22Financial%22,%22Cloud%20Services%22,%22Non-China%22]&customRules=[]&group_by_country=true";

      let localProxies = [];
      for (let i = 0; i < randomizedIPs.length; i++) {
        const account = TEAM_ACCOUNTS[i % TEAM_ACCOUNTS.length];
        const endIp = randomizedIPs[i]; 
        const endPort = portsPool[Math.floor(Math.random() * portsPool.length)];
        
        const nodeName = `ZT-${account.name}-P${endPort}-${i+1}`;
        const safePrivateKey = encodeURIComponent(account.private_key);
        const safePublicKey = encodeURIComponent(account.public_key);
        const safeAddress = encodeURIComponent(account.local_address);
        const safeReserved = encodeURIComponent(account.reserved_str);

        const wgLink = `wireguard://${safePrivateKey}@${endIp}:${endPort}?address=${safeAddress}&reserved=${safeReserved}&publickey=${safePublicKey}&mtu=${account.mtu}#${nodeName}`;
        localProxies.push(wgLink);
      }

      const rawNodesText = localProxies.join('\n');
      const base64Nodes = Buffer.from(rawNodesText, 'utf-8').toString('base64');

      // 实时将你最新的随机变量节点注入到空壳规则中
      let targetFetchUrl = finalTemplateUrl.replace(/config=[^&]*/, `config=data:text/plain;base64,${base64Nodes}`);

      const response = await fetch(targetFetchUrl, {
        headers: { "User-Agent": "clash-verge/1.0.0" }
      });

      if (!response.ok) {
        const errText = await response.text();
        return new Response(`Subconverter API Response Error: ${errText}`, { status: 200 });
      }

      const finalYamlConfig = await response.text();

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
    // 5. 【分支二：小火箭通用 Base64 订阅】
    // ==========================================
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
    const base64Response = Buffer.from(subscriptionContent, 'utf-8').toString('base64');

    return new Response(base64Response, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });

  } catch (err) {
    // 终极拦截：把任何运行时的小错误打印出来，绝不触发 500 僵死
    return new Response(`Vercel Runtime Safeguard: ${err.message}`, { status: 200 });
  }
}

export const POST = GET;
