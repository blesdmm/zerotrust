// 如果是 Next.js 项目，请解除下面这行的注释
// export const runtime = 'edge';

export async function GET(request) {
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

  // ==========================================
  // 2. 迁移：将 Cloudflare 的 env 替换为 Node 的 process.env
  // ==========================================
  let subnetsPool = [
    "162.159.192.0/24",
    "162.159.193.0/24",
    "162.159.204.0/24"
  ]; 
  
  let portsPool =;

  const ENV_SUBNETS = process.env.SUBNETS;
  const ENV_WG_PORTS = process.env.WG_PORTS;

  if (ENV_SUBNETS) {
    try {
      subnetsPool = JSON.parse(ENV_SUBNETS);
    } catch (e) {
      subnetsPool = ENV_SUBNETS.split(",").map(s => s.trim()).filter(Boolean);
    }
  }

  if (ENV_WG_PORTS) {
    try {
      portsPool = JSON.parse(ENV_WG_PORTS).map(Number);
    } catch (e) {
      portsPool = ENV_WG_PORTS.split(",").map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
    }
  }

  // ==========================================
  // 3. 按实际网段大小生成 IP 列表
  // ==========================================
  const generateAllEndIPs = () => {
    const ips = new Set();
    const ipToLong = (ip) => ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    const longToIp = (long) => [(long >>> 24) & 255, (long >>> 16) & 255, (long >>> 8) & 255, long & 255].join('.');

    for (const cidr of subnetsPool) {
      if (!cidr.includes('/')) {
        ips.add(cidr);
        continue;
      }
      const [baseIp, prefixStr] = cidr.split("/");
      const prefix = parseInt(prefixStr, 10);
      if (prefix >= 32) {
        ips.add(baseIp);
        continue;
      }
      const hostCount = (1 << (32 - prefix)) >>> 0;
      const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
      const baseLong = ipToLong(baseIp) & mask;
      const maxExtract = Math.min(hostCount, 256);

      for (let offset = 0; offset < maxExtract; offset++) {
        if (hostCount > 2 && (offset === 0 || offset === hostCount - 1)) {
          continue;
        }
        ips.add(longToIp((baseLong + offset) >>> 0));
      }
    }
    return Array.from(ips);
  };

  // ==========================================
  // 4. 核心分发逻辑
  // ==========================================
  const finalIPs = generateAllEndIPs();
  let proxyConfigs = [];

  for (let i = 0; i < finalIPs.length; i++) {
    const account = TEAM_ACCOUNTS[i % TEAM_ACCOUNTS.length];
    const endIp = finalIPs[i]; 
    const endPort = portsPool[Math.floor(Math.random() * portsPool.length)];

    const safePrivateKey = encodeURIComponent(account.private_key);
    const safePublicKey = encodeURIComponent(account.public_key);
    const safeAddress = encodeURIComponent(account.local_address);
    const safeReserved = encodeURIComponent(account.reserved_str);
    const nodeName = encodeURIComponent(`⚡ZT-P${endPort}-${account.name}-${i + 1}`);

    const wgLink = `wireguard://${safePrivateKey}@${endIp}:${endPort}?address=${safeAddress}&reserved=${safeReserved}&publickey=${safePublicKey}&mtu=${account.mtu}#${nodeName}`;
    proxyConfigs.push(wgLink);
  }

  if (proxyConfigs.length === 0) {
    return new Response("No valid IP addresses generated. Please check your SUBNETS variable.", { status: 400 });
  }

  const subscriptionContent = proxyConfigs.join("\n");
  const base64Response = btoa(unescape(encodeURIComponent(subscriptionContent)));

  // ==========================================
  // 5. 返回响应
  // ==========================================
  return new Response(base64Response, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  });
}

// 兼容不支持高级路由环境的纯 Vercel Serverless Function 
export const POST = GET;