import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../../../trpc/init';
import { PrismaClient } from '../../../generated/prisma';
const prisma= new PrismaClient();
const ClubSchema=z.object({
    id : z.string(),
    crn : z.number(),
    title :z.string(),
    description :z.string(),
    image_url :z.string().nullable(),
    banner_url : z.string().nullable(),
    _count : z.object({
        memberships : z.number(),
    }).optional(),




})
const ClubListSchema=z.array(ClubSchema);
const GetClubByIdInput=z.object({
    id:z.string().uuid(),
})
export const clubsListRouter=createTRPCRouter({
    getAllClubs : baseProcedure
        .output(ClubListSchema)
        .query(async function(){
            const clubs= await prisma.club.findMany({
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
        getClubById : baseProcedure
        .input(GetClubByIdInput)
        .output(ClubSchema)
        .query(async function({ input }){
            const club = await prisma.club.findUnique({
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