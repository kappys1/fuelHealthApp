/*
  Balance energético del día = ingesta − gasto, calculado en SERVIDOR (principio 1
  aplicado en la práctica: el coach ya no tiene que restar de cabeza, recibe el
  número). Es CONTEXTO ±25 %: el juez real del déficit es la pendiente de la
  báscula (server/analytics/deficit), no este dato de un solo día.

  Anti-doble-conteo: preferimos el gasto medido por el reloj (basal + activas; las
  kcal activas de Apple Watch YA incluyen el entreno). La sesión estimada del plan
  solo sustituye a «activas» cuando el reloj no las registró.
*/

export interface EnergyBalanceInput {
  intakeKcal: number;
  basalKcal: number | null;
  activeKcal: number | null;
  /** Estimación de la sesión (solo se usa si no hay kcal activas del reloj). */
  sessionKcal: number | null;
}

export interface EnergyBalance {
  intakeKcal: number;
  expenditureKcal: number | null;
  /** ingesta − gasto. Negativo = déficit. null si no hay datos de gasto. */
  balanceKcal: number | null;
  basis: "watch" | "estimate" | "none";
  /** Desglose legible del gasto (para el contexto del coach). */
  breakdown: string;
}

export function energyBalance(i: EnergyBalanceInput): EnergyBalance {
  const intakeKcal = i.intakeKcal;

  if (i.basalKcal != null && i.activeKcal != null) {
    const exp = i.basalKcal + i.activeKcal;
    return {
      intakeKcal,
      expenditureKcal: exp,
      balanceKcal: intakeKcal - exp,
      basis: "watch",
      breakdown: `basal ${Math.round(i.basalKcal)} + activas ${Math.round(i.activeKcal)}`,
    };
  }

  if (i.basalKcal != null && i.sessionKcal != null) {
    const exp = i.basalKcal + i.sessionKcal;
    return {
      intakeKcal,
      expenditureKcal: exp,
      balanceKcal: intakeKcal - exp,
      basis: "estimate",
      breakdown: `basal ${Math.round(i.basalKcal)} + sesión estimada ${Math.round(i.sessionKcal)}`,
    };
  }

  if (i.basalKcal != null) {
    return {
      intakeKcal,
      expenditureKcal: i.basalKcal,
      balanceKcal: intakeKcal - i.basalKcal,
      basis: "estimate",
      breakdown: `basal ${Math.round(i.basalKcal)} (sin actividad registrada)`,
    };
  }

  return {
    intakeKcal,
    expenditureKcal: null,
    balanceKcal: null,
    basis: "none",
    breakdown: "sin datos de gasto",
  };
}
