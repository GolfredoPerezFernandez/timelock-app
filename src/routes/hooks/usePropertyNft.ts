import { useSignal, $, isBrowser } from "@builder.io/qwik";
import { createWalletClient, createPublicClient, custom, http, formatUnits, parseUnits } from "viem";
import { timelock_abi } from "~/utils/TimelockABI";
import { base } from "viem/chains";

// Helper para acortar direcciones
export function shortAddr(addr: string | undefined | null) {
  if (!addr || typeof addr !== 'string' || addr.length < 10) return addr || '';
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// Qwik hook export pattern - mantiene por compatibilidad
export function usePropertyNft() {
  return { getOwnerOf$: $((tokenId: string | number) => Promise.resolve("0x0")) };
}

// Nueva implementación del hook para el contrato Timelock
export function useTimelock() {
  const address = useSignal<string | null>(null);
  const status = useSignal<string>("");
  const error = useSignal<string>("");
  const locks = useSignal<any[]>([]);
  const loadingLocks = useSignal(false);
  // No serializar los clientes, solo guardar address y estado
  // Los clientes se crean en cada llamada usando window.ethereum

  // Conectar wallet y clientes viem
  const connect = $(async () => {
    if (!isBrowser) {
        error.value = "MetaMask solo se puede usar en el navegador.";
        return false;
    }
    // Resetear los mensajes de error y estado primero
    error.value = "";
    status.value = "Conectando con MetaMask...";
    
    // Verificar que MetaMask esté instalado
    if (!(window as any).ethereum) {
      error.value = "MetaMask no detectado. Por favor, instala la extensión MetaMask";
      status.value = "";
      console.error("MetaMask no instalado");
      return false;
    }
    
    try {
      console.log("Solicitando conexión a MetaMask...");
      
      // Solicitar acceso a la cuenta (abre la ventana de MetaMask)
      const accounts = await (window as any).ethereum.request({ 
        method: 'eth_requestAccounts',
        params: [] 
      });
      
      // Verificar que obtuvimos cuentas
      // Verificar que obtuvimos cuentas
      if (!accounts || accounts.length === 0) {
        error.value = "No se autorizó el acceso a MetaMask";
        console.error("No se autorizó el acceso a MetaMask - No se devolvieron cuentas");
        return false;
      }
      
      // Establecer la dirección y el estado
      address.value = accounts[0];
      status.value = "Conectado: " + shortAddr(accounts[0]);
      console.log("Conectado exitosamente a MetaMask:", accounts[0]);
      
      // Configurar los listeners para cambios en la cuenta o la red
      // Primero eliminamos los listeners anteriores para evitar duplicados
      try {
        (window as any).ethereum.removeListener('accountsChanged', () => {});
      } catch (e) {
        console.log("No había listeners previos de accountsChanged");
      }
      
      // Añadimos el nuevo listener
      (window as any).ethereum.on('accountsChanged', (newAccounts: string[]) => {
        if (newAccounts.length === 0) {
          address.value = null;
          status.value = "";
          error.value = "Desconectado de MetaMask";
          console.log("Usuario desconectó MetaMask");
        } else {
          address.value = newAccounts[0];
          status.value = "Conectado: " + shortAddr(newAccounts[0]);
          error.value = "";
          console.log("Cuenta de MetaMask cambiada:", newAccounts[0]);
        }
      });
      
      // Retornar true para indicar que la conexión fue exitosa
      return true;
    } catch (e: any) {
      console.error("Error al conectar con MetaMask:", e);
      
      // Mejorar mensajes de error comunes
      if (e.code === 4001) {
        error.value = "Usuario rechazó la conexión con MetaMask";
      } else if (e.message?.includes("already processing")) {
        error.value = "MetaMask ya está procesando una solicitud. Por favor, completa la acción pendiente.";
      } else {
        error.value = e.message || "Error al conectar con MetaMask";
      }
      
      status.value = "";
      return false;
    }
  });

  // Dirección del contrato 
  // En producción usar la variable de entorno PUBLIC_TIMELOCK_CONTRACT
  const CONTRACT_ADDRESS = '0xa210Fff1cfD0ffBdF4A623682dB2102bef8473D2' as `0x${string}`;

  // Crear lock
  const createLock = $(async (token: string, totalAmount: string, recipients: string, amounts: string, releaseTime: string, invoiceId: string | number, automateAction?: any) => {
    if (!isBrowser) {
      error.value = "Esta acción solo se puede realizar en el navegador.";
      return;
    }
    error.value = "";
    status.value = "Procesando operación...";

    if (!address.value) {
      try {
        const connectedAddress = await connect();
        if (!connectedAddress) {
          error.value = "Conecta MetaMask primero";
          status.value = "";
          return;
        }
      } catch (e) {
        error.value = "Error al conectar con MetaMask";
        status.value = "";
        return;
      }
    }

    try {
      // ...validaciones y preparación de arrays igual...
      if (!token || !totalAmount || !recipients || !amounts || !releaseTime || invoiceId === undefined) {
        error.value = "Completa todos los campos";
        status.value = "";
        return;
      }
      const recArr = Array.isArray(recipients) ? recipients : recipients.split(",").map(s => s.trim());
      const amtArr = Array.isArray(amounts) ? amounts : amounts.split(",").map(s => s.trim()).map(Number);
      if (recArr.length !== amtArr.length) {
        error.value = "recipients y amounts deben tener la misma longitud";
        status.value = "";
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const relTime = Number(releaseTime);
      if (relTime <= now) {
        const releaseDate = new Date(relTime * 1000).toLocaleString();
        error.value = `La fecha de liberación (${releaseDate}) debe ser una fecha futura.`;
        status.value = "";
        return;
      }
      const decimals = 18;
      const total = parseUnits(totalAmount, decimals);
      const walletClient = createWalletClient({ chain: base, transport: custom((window as any).ethereum) });
      const publicClient = createPublicClient({ chain: base, transport: http(base.rpcUrls.default.http[0]) });
      const erc20Abi = [
        { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "approve", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" },
        { "inputs": [ { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" } ], "name": "allowance", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }
      ] as const;
      status.value = "Verificando aprobación de tokens...";
      const currentAllowance = await publicClient.readContract({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address.value as `0x${string}`, CONTRACT_ADDRESS]
      });
      if (currentAllowance < total) {
        status.value = "Aprobando tokens... Confirma en MetaMask";
        const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        await walletClient.writeContract({
          address: token as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [CONTRACT_ADDRESS, maxUint256],
          account: address.value as `0x${string}`
        });
        status.value = "Tokens aprobados. Creando timelock...";
      } else {
        status.value = "Aprobación de tokens ya existente. Creando timelock...";
      }
      // Crear el lock y obtener el hash de la transacción
      const lockTxHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: timelock_abi,
        functionName: "createLock",
        args: [
          token,
          total,
          recArr,
          amtArr.map(a => parseUnits(a.toString(), decimals)),
          relTime,
          typeof invoiceId === 'string' ? BigInt(invoiceId) : invoiceId
        ],
        account: address.value as `0x${string}`
      });
      status.value = "Esperando confirmación de la transacción...";
      // Esperar el receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: lockTxHash });
      if (receipt.status === 'success') {
        status.value = "Lock creado correctamente";
        error.value = "";
        // Solo automatizar el pago si la transacción fue exitosa
        if (automateAction) {
          await automateAction.submit({ invoiceId, releaseTimestamp: relTime });
        }
      } else {
        error.value = "La transacción fue revertida o cancelada. No se automatizó el pago.";
        status.value = "";
      }
    } catch (e: any) {
      console.error("Error al crear lock:", e);
      if (e.message?.includes("user rejected transaction")) {
        error.value = "Transacción rechazada por el usuario";
      } else if (e.message?.includes("insufficient funds")) {
        error.value = "Fondos insuficientes para completar la transacción";
      } else if (e.message?.includes("execution reverted")) {
        error.value = "Error en la ejecución del contrato: " + (e.message.split("execution reverted:")[1] || e.message);
      } else {
        error.value = e.message || "Error al crear lock";
      }
      status.value = "";
    }
  });

  // Leer locks usando getAllLocks
  const loadLocks = $(async () => {
    loadingLocks.value = true;
    error.value = "";
    console.log("[TimeLock] Iniciando carga de locks...");
    // DEBUG: Mostrar locks de la base de datos si están disponibles en window
    if ((window as any).dbLocks) {
      console.log('[TimeLock] dbLocks:', (window as any).dbLocks);
    }
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(base.rpcUrls.default.http[0])
      });
      console.log("[TimeLock] Llamando a getAllLocks en el contrato:", CONTRACT_ADDRESS);
      const result = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: timelock_abi,
        functionName: "getAllLocks"
      });
      console.log("[TimeLock] Resultado de getAllLocks:", result);
      // result: [ids, tokens, amounts, releaseTimes, released, recipients, recipientAmounts, invoiceIds]
      if (!result || !Array.isArray(result) || result.length < 8) {
        error.value = "El contrato no devolvió el formato esperado de locks.";
        console.error("[TimeLock] Formato inesperado:", result);
        locks.value = [];
        loadingLocks.value = false;
        return;
      }
      const [ids, tokens, amounts, releaseTimes, released, recipients, recipientAmounts, invoiceIds] = result as [
        number[], string[], bigint[], bigint[], boolean[], string[][], bigint[][], bigint[]
      ];
      const arr = (ids || []).map((id, idx) => ({
        id,
        token: tokens[idx],
        totalAmount: amounts[idx],
        releaseTime: releaseTimes[idx],
        released: released[idx],
        recipients: recipients[idx],
        amounts: recipientAmounts[idx],
        invoiceId: invoiceIds[idx]
      }));
      locks.value = arr;
      console.log("[TimeLock] Locks parseados:", arr);
    } catch (e: any) {
      error.value = e.message || "Error al leer locks";
      console.error("[TimeLock] Error al leer locks:", e);
    }
    loadingLocks.value = false;
  });

  // Liberar manualmente
  const performUpkeep = $(async () => {
    if (!isBrowser) {
        error.value = "Esta acción solo se puede realizar en el navegador.";
        return;
    }
    if (!address.value) return error.value = "Conecta MetaMask primero";
    try {
      const walletClient = createWalletClient({
        chain: base,
        transport: custom((window as any).ethereum)
      });
      await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: timelock_abi,
        functionName: "performUpkeep",
        args: ["0x"],
        account: address.value as `0x${string}`
      });
      status.value = "performUpkeep ejecutado";
      await loadLocks();
    } catch (e: any) {
      error.value = e.message || "Error en performUpkeep";
    }
  });

  return {
    address,
    status,
    error,
    locks,
    loadingLocks,
    connect,
    createLock,
    loadLocks,
    performUpkeep
  };
}