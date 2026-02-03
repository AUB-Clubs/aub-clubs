import { z } from 'zod';
import { publicProcedure, router } from '@/server/trpc';
import { PrismaClient } from '../../../src/generated/prisma';
const prisma= new PrismaClient();
const ClubSchema=z.object({
    id : z.string(),
    crn : z.string(),
    title :z.string(),
    description :z.string(),
    image :z.string().nullable(),
    banner : z.string().nullable(),
    _count : z.object({
        memberships : z.number(),
    }).optional(),




})
const ClubListSchema=z.array(ClubSchema);
const GetClubByIdInput=z.object({
    id:z.string().uuid(),
})
export const clubsRouter=router({
    getAllClubs : publicProcedure
        .output(ClubListSchema)
        .query(async function(){
            const clubs= await Prisma.club.findMany({
                include:{
                    _count:{
                        select:{
                            memberships:true,
                        },
                    },
                },
            });
            return clubs;
        }),
        getClubById : publicProcedure
        .input(GetClubByIdInput)
        .output(ClubSchema)
        .query(async function({ input }){
            const club = await Prisma.club.findUnique({
                where:{
                    id : input.id,

                },
                include:{
                    _count:{
                        select:{
                            memberships:true,
                        },
                    },
                },
            });
            if(!club){
                throw new Error("club not found");
            }
            return club;

        
}),

        
});