import { requireBarberSession } from "../../../../lib/supabase/authCheck";
import { supabaseServer } from "../../../../lib/supabase/server";

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

export async function GET(request) {
  try {
    const user = await requireBarberSession(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { data: settings, error } = await supabaseServer
      .from("barber_settings")
      .select("accepting_customers")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Response.json(
      { accepting_customers: settings?.accepting_customers ?? true },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to get settings", error);
    return jsonError("Something went wrong", 500);
  }
}

export async function PATCH(request) {
  try {
    const user = await requireBarberSession(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = await request.json();
    const acceptingCustomers = body?.accepting_customers;

    if (typeof acceptingCustomers !== "boolean") {
      return jsonError("accepting_customers must be a boolean", 400);
    }

    const { data: settings, error: lookupError } = await supabaseServer
      .from("barber_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (!settings) {
      const { data: inserted, error: insertError } = await supabaseServer
        .from("barber_settings")
        .insert({ accepting_customers: acceptingCustomers })
        .select("accepting_customers")
        .single();

      if (insertError) {
        throw insertError;
      }

      return Response.json(
        { accepting_customers: inserted.accepting_customers },
        { status: 200 }
      );
    }

    const { data: updated, error: updateError } = await supabaseServer
      .from("barber_settings")
      .update({
        accepting_customers: acceptingCustomers,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id)
      .select("accepting_customers")
      .single();

    if (updateError) {
      throw updateError;
    }

    return Response.json(
      { accepting_customers: updated.accepting_customers },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update settings", error);
    return jsonError("Something went wrong", 500);
  }
}
