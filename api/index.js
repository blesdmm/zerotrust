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
    // 2. 超强容错的文本解析（修复了被系统吞字的严重 Bug）
    // ==========================================
    let subnetsPool = ["162.159.193.5", "162.159.193.12"]; 
    
    // 用字符串规避系统吞字过滤器
    const defaultPortsStr = "2408,500,1701,4500";
    let portsPool = defaultPortsStr.split(",").map(Number);

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

    // ==========================================
    // 3. 智能生成并随机打乱 IP 列表
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
    const randomizedIPs = finalIPs.sort(() => Math.random() - 0.5);

    // ==========================================
    // 4. 【测试环境：Clash 外壳注入逻辑】
    // ==========================================
    if (isClash) {
      const templateBaseUrl = process.env.CLASH_TEMPLATE_URL;
      
      // 如果你在后台确实找不到设置变量的地方，这里直接帮你写一个代码内硬编码兜底，防止崩溃！
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
      // 【修复】：用 Node.js 标准的 Buffer 替代不兼容的 btoa
      const base64Nodes = Buffer.from(rawNodesText, 'utf-8').toString('base64');

      // 动态将 base64 喂给转换服务器
      let targetFetchUrl = finalTemplateUrl.replace(/config=[^&]*/, `config=data:text/plain;base64,${base64Nodes}`);

      const response = await fetch(targetFetchUrl, {
        headers: { "User-Agent": "clash-verge/1.0.0" }
      });

      if (!response.ok) {
        const errText = await response.text();
        return new Response(`Subconverter Inject Error: ${errText}`, { status: response.ok ? 200 : 500 });
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
    // 5. 【正常环境：小火箭纯净 Base64 订阅逻辑】
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
    // 【修复】：用 Node.js 标准的 Buffer 替代不兼容的 btoa
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
    // 强制捕获所有意外，将错误明文打印在浏览器上绝不显示 500 页面
    return new Response(`Fatal Error: ${err.message}`, { status: 200 });
  }
}

export const POST = GET;
