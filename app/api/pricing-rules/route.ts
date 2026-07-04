import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import PricingRule from '@/models/PricingRule';
import Country from '@/models/Country';
import Procedure from '@/models/Procedure';
import Service from '@/models/Service';
import { getUserFromRequest } from '@/lib/auth';
import { buildPricingRulePayload, enrichPricingRuleObject } from '@/lib/pricing-rule-payload';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const country = searchParams.get('country');
    const serviceId = (searchParams.get('serviceId') || '').trim();
    const countryId = (searchParams.get('countryId') || '').trim();
    const procedureId = (searchParams.get('procedureId') || '').trim();
    const clientId = searchParams.get('clientId');
    const exactClient = searchParams.get('exactClient') === 'true' || searchParams.get('exactClient') === '1';
    const procedureName = (searchParams.get('procedureName') || '').trim();
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? '10');

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const skip = (page - 1) * limit;

    const andFilters: Record<string, any>[] = [];

    if (serviceId) {
      if (!mongoose.Types.ObjectId.isValid(serviceId)) {
        return NextResponse.json({ error: 'Invalid serviceId' }, { status: 400 });
      }
      const service = await Service.findById(serviceId).lean();
      if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      andFilters.push({ serviceCategory: service.category });
    }

    if (category) {
      const normalizedCategory = String(category).trim();
      if (normalizedCategory) {
        andFilters.push({ serviceCategory: normalizedCategory });
      }
    }

    if (country) {
      const safeCountry = country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andFilters.push({
        $or: [
          { countryName: { $regex: safeCountry, $options: 'i' } },
          { countryAbbreviation: { $regex: safeCountry, $options: 'i' } },
        ],
      });
    }

    if (countryId) {
      if (!mongoose.Types.ObjectId.isValid(countryId)) {
        return NextResponse.json({ error: 'Invalid countryId' }, { status: 400 });
      }
      const countryDoc = await Country.findById(countryId).lean();
      if (!countryDoc) return NextResponse.json({ error: 'Country not found' }, { status: 404 });
      andFilters.push({
        $or: [
          { countryName: String(countryDoc.name || '') },
          { countryAbbreviation: String(countryDoc.abbreviation || '').toUpperCase() },
        ],
      });
    }

    if (clientId) {
      const normalizedClientId = String(clientId).trim();
      if (!mongoose.Types.ObjectId.isValid(normalizedClientId)) {
        return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });
      }

      andFilters.push({
        ...(exactClient
          ? { clientId: new mongoose.Types.ObjectId(normalizedClientId) }
          : {
              $or: [
                { clientId: new mongoose.Types.ObjectId(normalizedClientId) },
                { clientId: { $exists: false } },
                { clientId: null },
              ],
            }),
      });
    }

    if (procedureName) {
      const safeProcedureName = procedureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andFilters.push({ procedureName: { $regex: `^${safeProcedureName}$`, $options: 'i' } });
    }

    if (procedureId) {
      if (!mongoose.Types.ObjectId.isValid(procedureId)) {
        return NextResponse.json({ error: 'Invalid procedureId' }, { status: 400 });
      }
      const procedure = await Procedure.findById(procedureId).lean();
      if (!procedure) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
      const safeProcedureName = String(procedure.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andFilters.push({ procedureName: { $regex: `^${safeProcedureName}$`, $options: 'i' } });
    }

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andFilters.push({
        $or: [
          { serviceCategory: { $regex: safeSearch, $options: 'i' } },
          { clientName: { $regex: safeSearch, $options: 'i' } },
          { procedureName: { $regex: safeSearch, $options: 'i' } },
          { countryName: { $regex: safeSearch, $options: 'i' } },
          { countryAbbreviation: { $regex: safeSearch, $options: 'i' } },
        ],
      });
    }

    let isActiveFilter: boolean | undefined = true;
    if (status) {
      const normalizedStatus = status.toLowerCase().trim();
      if (normalizedStatus === 'active') isActiveFilter = true;
      else if (normalizedStatus === 'inactive') isActiveFilter = false;
      else if (normalizedStatus === 'all') isActiveFilter = undefined;
    }

    const filter: Record<string, any> = {
      ...(isActiveFilter !== undefined ? { isActive: isActiveFilter } : {}),
      ...(andFilters.length > 0 ? { $and: andFilters } : {}),
    };

    const [pricingRules, total] = await Promise.all([
      PricingRule.find(filter)
        .sort({
          serviceCategory: 1,
          countryName: 1,
          procedureName: 1,
        })
        .skip(skip)
        .limit(limit),
      PricingRule.countDocuments(filter),
    ]);

    const countryAbbreviations = Array.from(
      new Set(pricingRules.map((rule) => String(rule.countryAbbreviation || '').toUpperCase()))
    ).filter(Boolean);
    const serviceCategories = Array.from(
      new Set(pricingRules.map((rule) => rule.serviceCategory))
    ).filter(Boolean);
    const procedureNames = Array.from(
      new Set(pricingRules.map((rule) => rule.procedureName))
    ).filter(Boolean);

    const [countriesData, servicesData, proceduresData] = await Promise.all([
      Country.find({ abbreviation: { $in: countryAbbreviations } }).lean(),
      Service.find({ category: { $in: serviceCategories } }).lean(),
      Procedure.find({
        isActive: true,
        serviceCategory: { $in: serviceCategories },
        name: { $in: procedureNames },
      }).lean(),
    ]);

    const countryMap = countriesData.reduce<Record<string, any>>((acc, countryData) => {
      acc[countryData.abbreviation.toUpperCase()] = countryData;
      return acc;
    }, {});

    const serviceMap = servicesData.reduce<Record<string, any>>((acc, serviceData) => {
      acc[serviceData.category] = serviceData;
      return acc;
    }, {});
    const procedureMap = proceduresData.reduce<Record<string, any>>((acc, procedureData) => {
      acc[`${procedureData.serviceCategory}::${String(procedureData.name || '').toLowerCase()}`] = procedureData;
      return acc;
    }, {});

    const pricingRulesWithDetails = pricingRules.map((rule) => {
      const ruleObject = rule.toObject();
      const countryDetail = countryMap[String(ruleObject.countryAbbreviation || '').toUpperCase()] || null;
      const serviceDetail = serviceMap[ruleObject.serviceCategory] || null;
      const procedureDetail =
        procedureMap[`${ruleObject.serviceCategory}::${String(ruleObject.procedureName || '').toLowerCase()}`] ||
        null;
      return {
        ...ruleObject,
        status: ruleObject.isActive ? 'Active' : 'Inactive',
        country: countryDetail
          ? {
              _id: countryDetail._id,
              name: countryDetail.name,
              abbreviation: countryDetail.abbreviation,
              flagCode: countryDetail.flagCode,
              isActive: countryDetail.isActive,
            }
          : null,
        service: serviceDetail
          ? {
              _id: serviceDetail._id,
              name: serviceDetail.name,
              category: serviceDetail.category,
              basePrice: serviceDetail.basePrice,
              isActive: serviceDetail.isActive,
            }
          : null,
        procedure: procedureDetail
          ? {
              _id: procedureDetail._id,
              name: procedureDetail.name,
              serviceCategory: procedureDetail.serviceCategory,
              serviceName: procedureDetail.serviceName,
              isActive: procedureDetail.isActive,
            }
          : null,
      };
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return NextResponse.json({ pricingRules: pricingRulesWithDetails, total, page, limit, totalPages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only administrators can manage pricing rules' }, { status: 403 });
    }

    await connectDB();

    const body = (await req.json()) as Record<string, unknown>;
    const payload = await buildPricingRulePayload(body);
    if ('error' in payload) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const duplicate = await PricingRule.findOne({
      ...(payload.data.clientId ? { clientId: payload.data.clientId } : { clientId: { $exists: false } }),
      serviceCategory: payload.data.serviceCategory,
      countryAbbreviation: payload.data.countryAbbreviation,
      procedureName: payload.data.procedureName,
    }).lean();
    if (duplicate) {
      return NextResponse.json({ error: 'Price rule already exists for this client, procedure, country, and service' }, { status: 409 });
    }

    const pricingRule = await PricingRule.create(payload.data);
    const pricingRuleWithDetails = await enrichPricingRuleObject(pricingRule.toObject());

    return NextResponse.json(pricingRuleWithDetails, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
